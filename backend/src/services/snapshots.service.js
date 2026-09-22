const fs = require('fs');
const path = require('path');
const db = require('../db');
const { SNAPSHOTS_DIR } = require('../config/paths');
const { DATASET_BY_KEY, listDatasets } = require('./storagePools.service');

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const intFromEnv = (name, fallback) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
// How often the "is a scheduled snapshot due" check runs, and how long a day/week actually is - both
// overridable so a test can see scheduling behaviour in seconds instead of waiting real days.
const CHECK_INTERVAL_MS = intFromEnv('VORLAN_SNAPSHOT_CHECK_MS', 60 * 60 * 1000);
const DAILY_MS = intFromEnv('VORLAN_SNAPSHOT_DAILY_MS', 24 * 60 * 60 * 1000);

const datasetDir = (key) => path.join(SNAPSHOTS_DIR, key);

/** Recursively sizes a folder. There's no MAX_ENTRIES_SCANNED budget here (unlike the live storage
 * scan) because a snapshot is taken once, deliberately, not polled every 30 seconds. */
const measure = async (dir) => {
  let bytes = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    // eslint-disable-next-line no-await-in-loop
    let entries;
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        // eslint-disable-next-line no-await-in-loop
        const stat = await fs.promises.stat(full).catch(() => null);
        if (stat) { bytes += stat.size; files += 1; }
      }
    }
  }
  return { bytes, files };
};

const timestampFolder = (date = new Date()) => date.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');

const publicRow = (r) => ({
  id: r.id, datasetKey: r.dataset_key, takenAt: r.taken_at, folderName: r.folder_name,
  bytes: r.bytes, files: r.files, kind: r.kind, createdBy: r.created_by, status: r.status, note: r.note,
});

const listSnapshots = async (datasetKey) => {
  const rows = await all('SELECT * FROM dataset_snapshots WHERE dataset_key = ? ORDER BY taken_at DESC', [datasetKey]);
  return rows.map(publicRow);
};

/** Deletes the oldest snapshots of one kind past the keep count, on disk and in the database. */
const pruneKind = async (datasetKey, kind, keep) => {
  const rows = await all(
    'SELECT * FROM dataset_snapshots WHERE dataset_key = ? AND kind = ? AND status = ? ORDER BY taken_at DESC',
    [datasetKey, kind, 'ok']
  );
  for (const row of rows.slice(keep)) {
    // eslint-disable-next-line no-await-in-loop
    await fs.promises.rm(path.join(datasetDir(datasetKey), row.folder_name), { recursive: true, force: true });
    // eslint-disable-next-line no-await-in-loop
    await run('DELETE FROM dataset_snapshots WHERE id = ?', [row.id]);
  }
};

/** Copies a dataset's live folder into a new timestamped snapshot. Recorded even on failure, so a
 * broken scheduled snapshot shows up in the list instead of silently not happening. */
const takeSnapshot = async (datasetKey, { kind = 'manual', createdBy = null } = {}) => {
  const def = DATASET_BY_KEY[datasetKey];
  if (!def) throw notFound('No such dataset.');

  const takenAt = new Date();
  // The timestamp has 1-second resolution, so two snapshots of the same dataset taken within the
  // same second (easily done - e.g. a restore's own safety snapshot, moments after a manual one)
  // would otherwise collide on folder name. A numbered suffix keeps every snapshot in its own folder.
  const base = timestampFolder(takenAt);
  let folderName = base;
  for (let n = 2; fs.existsSync(path.join(datasetDir(datasetKey), folderName)); n += 1) folderName = `${base}_${n}`;
  const dest = path.join(datasetDir(datasetKey), folderName);

  try {
    await fs.promises.mkdir(dest, { recursive: true });
    await fs.promises.cp(def.path, dest, { recursive: true, force: true, errorOnExist: false });
    const { bytes, files } = await measure(dest);
    const result = await run(
      'INSERT INTO dataset_snapshots (dataset_key, taken_at, folder_name, bytes, files, kind, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [datasetKey, takenAt.toISOString(), folderName, bytes, files, kind, createdBy, 'ok']
    );

    if (kind === 'pre-restore') {
      await pruneKind(datasetKey, 'pre-restore', 3);
    } else {
      const dataset = (await listDatasets()).find((d) => d.key === datasetKey);
      await pruneKind(datasetKey, kind === 'scheduled' ? 'scheduled' : 'manual', dataset?.snapshotRetain || 7);
    }

    return publicRow({ id: result.lastID, dataset_key: datasetKey, taken_at: takenAt.toISOString(), folder_name: folderName, bytes, files, kind, created_by: createdBy, status: 'ok', note: null });
  } catch (err) {
    await run(
      'INSERT INTO dataset_snapshots (dataset_key, taken_at, folder_name, bytes, files, kind, created_by, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [datasetKey, takenAt.toISOString(), folderName, null, null, kind, createdBy, 'failed', err.message]
    ).catch(() => {});
    await fs.promises.rm(dest, { recursive: true, force: true }).catch(() => {});
    throw badRequest(`Couldn't take the snapshot: ${err.message}`);
  }
};

const deleteSnapshot = async (id) => {
  const row = await get('SELECT * FROM dataset_snapshots WHERE id = ?', [id]);
  if (!row) throw notFound('That snapshot no longer exists.');
  await fs.promises.rm(path.join(datasetDir(row.dataset_key), row.folder_name), { recursive: true, force: true });
  await run('DELETE FROM dataset_snapshots WHERE id = ?', [id]);
  return publicRow(row);
};

/**
 * Replaces a dataset's live folder with the contents of one of its snapshots. A fresh "pre-restore"
 * snapshot of what was live is taken first (and kept, capped at the 3 most recent), so a restore
 * that turns out to be a mistake can itself be undone the same way.
 */
const restoreSnapshot = async (id, { createdBy = null } = {}) => {
  const row = await get('SELECT * FROM dataset_snapshots WHERE id = ?', [id]);
  if (!row) throw notFound('That snapshot no longer exists.');
  if (row.status !== 'ok') throw badRequest("That snapshot didn't complete successfully and can't be restored.");
  const def = DATASET_BY_KEY[row.dataset_key];
  if (!def) throw notFound('No such dataset.');

  const source = path.join(datasetDir(row.dataset_key), row.folder_name);
  if (!fs.existsSync(source)) throw notFound('The files for that snapshot are no longer on disk.');

  const before = await takeSnapshot(row.dataset_key, { kind: 'pre-restore', createdBy });

  const liveEntries = await fs.promises.readdir(def.path, { withFileTypes: true }).catch(() => []);
  for (const entry of liveEntries) {
    // eslint-disable-next-line no-await-in-loop
    await fs.promises.rm(path.join(def.path, entry.name), { recursive: true, force: true });
  }
  await fs.promises.cp(source, def.path, { recursive: true, force: true, errorOnExist: false });

  return { restored: publicRow(row), safetySnapshot: before };
};

/** Once an hour: takes a scheduled snapshot for any dataset that's due. Frequency is only daily or
 * weekly, so an hourly check is more than fine-grained enough. */
const runScheduled = async () => {
  const datasets = await listDatasets();
  for (const dataset of datasets) {
    if (!dataset.snapshotsEnabled) continue;
    // eslint-disable-next-line no-await-in-loop
    const last = await get(
      "SELECT taken_at FROM dataset_snapshots WHERE dataset_key = ? AND kind = 'scheduled' AND status = 'ok' ORDER BY taken_at DESC LIMIT 1",
      [dataset.key]
    );
    const intervalMs = (dataset.snapshotFrequency === 'weekly' ? 7 : 1) * DAILY_MS;
    const due = !last || Date.now() - new Date(last.taken_at).getTime() >= intervalMs;
    if (due) {
      // eslint-disable-next-line no-await-in-loop
      await takeSnapshot(dataset.key, { kind: 'scheduled', createdBy: null }).catch((err) => console.error(`Scheduled snapshot failed for ${dataset.key}:`, err.message));
    }
  }
};

let timer = null;
const start = () => {
  runScheduled().catch((err) => console.error('Scheduled snapshot check failed:', err.message));
  timer = setInterval(() => runScheduled().catch((err) => console.error('Scheduled snapshot check failed:', err.message)), CHECK_INTERVAL_MS);
  timer.unref();
};
const stop = () => { if (timer) clearInterval(timer); timer = null; };

module.exports = { listSnapshots, takeSnapshot, deleteSnapshot, restoreSnapshot, start, stop, runScheduled };
