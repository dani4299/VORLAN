const os = require('os');
const fs = require('fs/promises');
const { constants: fsConstants } = require('fs');
const { spawn } = require('child_process');
const db = require('../db');
const storagePools = require('./storagePools.service');

// SMB/NFS sharing (Phase 7). Talks to the real system the same way Phase 4 talks to Docker: by
// shelling out to the CLI tools that manage Samba/NFS, never a library or a config-management API.
//
// "personal" is deliberately never shareable: it's a folder of every VORLAN user's PIN-locked
// vault, and a file share has no concept of VORLAN's own per-account PIN gate - exporting it would
// let any authenticated SMB user (i.e. any VORLAN account) browse straight past everyone else's PIN.
const SHAREABLE_KEYS = ['documents', 'uploads', 'pictures', 'music', 'media'];

// VORLAN's own smb.conf snippet and NFS exports file. Owned by the installing user (chowned once,
// at install time, by install-system-deps.sh) specifically so writing them never needs root - only
// telling the already-running smbd/nfsd to re-read them does, which is what the sudo calls below are for.
const SMB_SHARES_CONF = '/etc/samba/vorlan-shares.conf';
const NFS_EXPORTS_FILE = '/etc/exports.d/vorlan.exports';

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const problem = (status, message) => Object.assign(new Error(message), { status });

/** Runs a privileged one-liner through the narrow sudoers rule the installer wrote - never a shell,
 * never a string the caller builds, only ever these exact argv arrays. Resolves with stdout+stderr
 * on success; on failure resolves `{ ok: false, message }` rather than throwing, since none of this
 * should ever take down the account-management flow that triggered it. */
const sudoRun = (args, { input } = {}) => new Promise((resolve) => {
  const proc = spawn('sudo', ['-n', ...args], { windowsHide: true });
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => { stdout += d; });
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('error', (err) => resolve({ ok: false, message: err.message }));
  proc.on('close', (code) => resolve(code === 0 ? { ok: true, stdout } : { ok: false, message: stderr.trim() || `exited ${code}` }));
  if (input !== undefined) proc.stdin.end(input);
});

/** Whether `cmd` is installed - only ENOENT (no such binary) counts as "no"; any exit code, even a
 * non-zero one from an unrecognized flag, means the binary itself was found and ran. */
const commandExists = (cmd) => new Promise((resolve) => {
  const proc = spawn(cmd, ['--version'], { windowsHide: true });
  proc.on('error', (err) => resolve(err.code !== 'ENOENT'));
  proc.on('close', () => resolve(true));
});

/** Whether this install can actually manage shares: Linux, with Samba/NFS tooling present and the
 * config files writable (i.e. the installer's sharing step has actually run). Never throws. */
const ping = async () => {
  if (process.platform !== 'linux') return { available: false, reason: 'SMB/NFS sharing needs Linux.' };
  const [hasSmbpasswd, hasExportfs] = await Promise.all([commandExists('smbpasswd'), commandExists('exportfs')]);
  if (!hasSmbpasswd || !hasExportfs) return { available: false, reason: 'Samba and/or NFS are not installed.' };
  try {
    await fs.access(SMB_SHARES_CONF, fsConstants.W_OK);
    await fs.access(NFS_EXPORTS_FILE, fsConstants.W_OK);
  } catch {
    return { available: false, reason: "The installer's sharing step hasn't set this up yet." };
  }
  return { available: true };
};

/** Every shareable dataset with its current smb/nfs flags (false if no row exists yet). */
const listShares = async () => {
  const [datasets, rows] = await Promise.all([storagePools.listDatasets(), all('SELECT * FROM dataset_shares')]);
  const byKey = Object.fromEntries(rows.map((r) => [r.dataset_key, r]));
  return datasets.filter((d) => SHAREABLE_KEYS.includes(d.key)).map((d) => ({
    key: d.key,
    label: d.label,
    path: d.path, // admin-only route/UI - fine to show the real export path an admin needs to mount it
    smbEnabled: Boolean(byKey[d.key]?.smb_enabled),
    nfsEnabled: Boolean(byKey[d.key]?.nfs_enabled),
  }));
};

/** Regenerates both config files from the DB's current flags and asks the already-running daemons
 * to re-read them. Writing the files never needs root (VORLAN owns them); the reload does. */
const applyShares = async () => {
  const shares = await listShares();
  const datasets = await storagePools.listDatasets();
  const pathByKey = Object.fromEntries(datasets.map((d) => [d.key, d.path]));
  const { uid, gid, username } = os.userInfo();

  const smbBlocks = shares.filter((s) => s.smbEnabled).map((s) => `
[${s.label}]
   path = ${pathByKey[s.key]}
   browseable = yes
   read only = no
   guest ok = no
   force user = ${username}
`).join('');
  await fs.writeFile(SMB_SHARES_CONF, smbBlocks || '# No SMB shares are turned on.\n');

  // `all_squash` + `anonuid`/`anongid` map every NFS client to the single Linux account VORLAN
  // itself runs as (the same one `force user` above uses for SMB), so files created either way end
  // up owned the same way. NFSv3 has no login step of its own - unlike the SMB shares above, these
  // exports trust any device that can reach this machine on the network, not just signed-in VORLAN
  // accounts. That's stated plainly in installer/README.md, not hidden.
  const nfsLines = shares.filter((s) => s.nfsEnabled)
    .map((s) => `${pathByKey[s.key]} *(rw,sync,no_subtree_check,all_squash,anonuid=${uid},anongid=${gid})`)
    .join('\n');
  await fs.writeFile(NFS_EXPORTS_FILE, nfsLines ? `${nfsLines}\n` : '# No NFS shares are turned on.\n');

  const [smbReload, nfsReload] = await Promise.all([
    smbBlocks ? sudoRun(['smbcontrol', 'smbd', 'reload-config']) : { ok: true },
    sudoRun(['exportfs', '-ra']),
  ]);
  if (!smbReload.ok) throw problem(500, `Wrote the SMB config but couldn't reload it: ${smbReload.message}`);
  if (!nfsReload.ok) throw problem(500, `Wrote the NFS exports but couldn't reload them: ${nfsReload.message}`);
};

const setShare = async (key, { smbEnabled, nfsEnabled }) => {
  if (!SHAREABLE_KEYS.includes(key)) {
    throw problem(404, key === 'personal'
      ? 'Personal vaults stay private - each one is protected by its owner’s own PIN, which sharing has no way to enforce.'
      : 'No such shareable dataset.');
  }
  const status = await ping();
  if (!status.available) throw problem(409, status.reason);

  const now = new Date().toISOString();
  await run(
    `INSERT INTO dataset_shares (dataset_key, smb_enabled, nfs_enabled, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(dataset_key) DO UPDATE SET
       smb_enabled = COALESCE(?, smb_enabled), nfs_enabled = COALESCE(?, nfs_enabled), updated_at = ?`,
    [key, smbEnabled ? 1 : 0, nfsEnabled ? 1 : 0, now, smbEnabled === undefined ? null : (smbEnabled ? 1 : 0), nfsEnabled === undefined ? null : (nfsEnabled ? 1 : 0), now]
  );
  await applyShares();
  return (await listShares()).find((s) => s.key === key);
};

/** Called wherever a plaintext password is briefly available (signup, self-service change, an
 * admin's create/reset) so the same login works from a Windows/Mac file browser. Best-effort and
 * silent on failure - a share sync problem must never block signing up or changing a password. */
const syncSambaUser = async (username, plainPassword) => {
  if (process.platform !== 'linux') return;
  const status = await ping();
  if (!status.available) return;
  const result = await sudoRun(['smbpasswd', '-s', '-a', username], { input: `${plainPassword}\n${plainPassword}\n` });
  if (!result.ok) console.warn(`Couldn't sync the Samba account for ${username}:`, result.message);
};

/** Called on account deletion, and on a rename (Samba has no rename of its own - the account is
 * removed under the old name; SMB access comes back once a password is next set under the new one,
 * which is stated in installer/README.md). Best-effort, same reasoning as above. */
const removeSambaUser = async (username) => {
  if (process.platform !== 'linux') return;
  const status = await ping();
  if (!status.available) return;
  const result = await sudoRun(['smbpasswd', '-s', '-x', username]);
  if (!result.ok && !/cannot locate|does not exist/i.test(result.message)) {
    console.warn(`Couldn't remove the Samba account for ${username}:`, result.message);
  }
};

module.exports = { SHAREABLE_KEYS, ping, listShares, setShare, syncSambaUser, removeSambaUser };
