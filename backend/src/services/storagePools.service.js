const si = require('systeminformation');
const db = require('../db');
const { EXPLORER_DIR, GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR, SECURE_VAULT_DIR } = require('../config/paths');
const path = require('path');

/**
 * The fixed set of datasets this phase manages: VORLAN's own top-level folders, each given a quota
 * and a snapshot schedule. A future phase might let admins create their own; for now these six are it.
 */
const DATASET_DEFS = [
  { key: 'documents', label: 'Documents', path: path.join(EXPLORER_DIR, 'Documents') },
  { key: 'uploads', label: 'Uploads', path: path.join(EXPLORER_DIR, 'Uploads') },
  { key: 'pictures', label: 'Pictures', path: path.join(EXPLORER_DIR, 'Pictures') },
  { key: 'music', label: 'Music', path: path.join(EXPLORER_DIR, 'Music') },
  { key: 'media', label: 'Shared media', path: GLOBAL_MEDIA_DIR },
  { key: 'personal', label: 'Personal vaults', path: PERSONAL_VAULT_DIR },
];
const DATASET_BY_KEY = Object.fromEntries(DATASET_DEFS.map((d) => [d.key, d]));

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

/** Every fixed, writable local disk. Network shares and read-only/optical drives are left out - they
 * aren't candidates for holding VORLAN's own data. */
const fixedDisks = async () => {
  const disks = await si.fsSize().catch(() => []);
  return disks.filter((d) => d.rw && d.mount);
};

/** Which of the disks above is currently holding VORLAN's data: the mount that is the longest prefix of it. */
const hostMount = (disks) => {
  const home = SECURE_VAULT_DIR.toLowerCase();
  let best = null;
  for (const d of disks) {
    const mount = (d.mount || '').toLowerCase();
    if (mount && home.startsWith(mount) && (!best || mount.length > best.length)) best = d.mount;
  }
  return best;
};

/**
 * Runs once at startup. If no pool exists yet, creates one from whichever disk already holds the
 * data (no admin action needed - there is nothing to choose between on a single-disk machine), and
 * registers the six fixed datasets against it. Safe to call on every start: everything it does is
 * "insert if missing".
 */
const ensureDefaults = async () => {
  let pool = await get('SELECT * FROM storage_pools ORDER BY id ASC LIMIT 1');
  if (!pool) {
    const disks = await fixedDisks();
    const mount = hostMount(disks) || disks[0]?.mount || 'C:';
    const result = await run('INSERT INTO storage_pools (name, created_at) VALUES (?, ?)', ['Main pool', new Date().toISOString()]);
    await run('INSERT INTO storage_pool_members (pool_id, mount, added_at) VALUES (?, ?, ?)', [result.lastID, mount, new Date().toISOString()]);
    pool = { id: result.lastID, name: 'Main pool' };
  }

  for (const def of DATASET_DEFS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await get('SELECT key FROM datasets WHERE key = ?', [def.key]);
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await run('INSERT INTO datasets (key, pool_id, label, updated_at) VALUES (?, ?, ?, ?)', [def.key, pool.id, def.label, new Date().toISOString()]);
    }
  }
};

/** Pools with their member disks and the combined capacity/free space across those disks. */
const listPools = async () => {
  const [pools, members, disks] = await Promise.all([
    all('SELECT * FROM storage_pools ORDER BY id ASC'),
    all('SELECT * FROM storage_pool_members ORDER BY id ASC'),
    fixedDisks(),
  ]);
  const diskByMount = Object.fromEntries(disks.map((d) => [d.mount, d]));

  return pools.map((p) => {
    const poolMembers = members.filter((m) => m.pool_id === p.id).map((m) => ({
      mount: m.mount,
      addedAt: m.added_at,
      sizeBytes: diskByMount[m.mount]?.size ?? null,
      usedBytes: diskByMount[m.mount]?.used ?? null,
      availableBytes: diskByMount[m.mount]?.available ?? null,
      online: Boolean(diskByMount[m.mount]),
    }));
    return {
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      members: poolMembers,
      sizeBytes: poolMembers.reduce((sum, m) => sum + (m.sizeBytes || 0), 0),
      availableBytes: poolMembers.reduce((sum, m) => sum + (m.availableBytes || 0), 0),
    };
  });
};

/** Disks not already claimed by any pool. Reported so the admin can see them; adding one to a pool
 * isn't wired up yet (there's a second disk to test that against on this machine yet). */
const listAvailableDisks = async () => {
  const [disks, members] = await Promise.all([fixedDisks(), all('SELECT mount FROM storage_pool_members')]);
  const claimed = new Set(members.map((m) => m.mount));
  return disks.filter((d) => !claimed.has(d.mount)).map((d) => ({ mount: d.mount, type: d.type, sizeBytes: d.size, availableBytes: d.available }));
};

/** Every dataset with its stored settings (quota, snapshot schedule). Usage is computed elsewhere
 * (adminSystem.service.js already scans these same folders for the Storage Manager's location list). */
const listDatasets = async () => {
  const rows = await all('SELECT * FROM datasets ORDER BY key ASC');
  return rows.map((r) => ({
    key: r.key,
    poolId: r.pool_id,
    label: r.label,
    path: DATASET_BY_KEY[r.key]?.path ?? null,
    quotaBytes: r.quota_bytes,
    snapshotsEnabled: Boolean(r.snapshots_enabled),
    snapshotFrequency: r.snapshot_frequency,
    snapshotRetain: r.snapshot_retain,
    updatedAt: r.updated_at,
  }));
};

const getDataset = async (key) => {
  const row = await get('SELECT * FROM datasets WHERE key = ?', [key]);
  if (!row) return null;
  return {
    key: row.key, poolId: row.pool_id, label: row.label, path: DATASET_BY_KEY[key]?.path ?? null,
    quotaBytes: row.quota_bytes, snapshotsEnabled: Boolean(row.snapshots_enabled),
    snapshotFrequency: row.snapshot_frequency, snapshotRetain: row.snapshot_retain, updatedAt: row.updated_at,
  };
};

const FREQUENCIES = ['daily', 'weekly'];

/** Updates the settings an admin can actually change: quota and snapshot schedule. Everything else about a dataset is fixed. */
const updateDataset = async (key, { quotaBytes, snapshotsEnabled, snapshotFrequency, snapshotRetain } = {}) => {
  const existing = await get('SELECT key FROM datasets WHERE key = ?', [key]);
  if (!existing) { const err = new Error('No such dataset.'); err.status = 404; throw err; }

  if (quotaBytes !== undefined && quotaBytes !== null && (!Number.isFinite(quotaBytes) || quotaBytes < 0)) {
    const err = new Error('The quota must be a positive number of bytes, or empty for no limit.'); err.status = 400; throw err;
  }
  if (snapshotFrequency !== undefined && !FREQUENCIES.includes(snapshotFrequency)) {
    const err = new Error(`Frequency must be one of: ${FREQUENCIES.join(', ')}.`); err.status = 400; throw err;
  }
  if (snapshotRetain !== undefined && (!Number.isInteger(snapshotRetain) || snapshotRetain < 1 || snapshotRetain > 60)) {
    const err = new Error('Keep between 1 and 60 snapshots.'); err.status = 400; throw err;
  }

  const fields = [];
  const params = [];
  if (quotaBytes !== undefined) { fields.push('quota_bytes = ?'); params.push(quotaBytes); }
  if (snapshotsEnabled !== undefined) { fields.push('snapshots_enabled = ?'); params.push(snapshotsEnabled ? 1 : 0); }
  if (snapshotFrequency !== undefined) { fields.push('snapshot_frequency = ?'); params.push(snapshotFrequency); }
  if (snapshotRetain !== undefined) { fields.push('snapshot_retain = ?'); params.push(snapshotRetain); }
  if (!fields.length) return getDataset(key);

  fields.push('updated_at = ?'); params.push(new Date().toISOString());
  params.push(key);
  await run(`UPDATE datasets SET ${fields.join(', ')} WHERE key = ?`, params);
  return getDataset(key);
};

module.exports = {
  DATASET_DEFS, DATASET_BY_KEY,
  ensureDefaults, listPools, listAvailableDisks, listDatasets, getDataset, updateDataset,
};
