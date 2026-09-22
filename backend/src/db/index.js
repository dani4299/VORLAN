const sqlite3 = require('sqlite3').verbose();
const { DB_FILE } = require('../config/paths');

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Database failed to open:', err.message);
  } else {
    console.log('VORLAN database connected.');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT CHECK(role IN ('admin', 'employee', 'guest')) DEFAULT 'guest'
    )
  `);

  // Added after the initial release — ALTER TABLE ADD COLUMN isn't idempotent in
  // sqlite3, so these fail silently with "duplicate column" on every restart but the first.
  db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN full_name TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN created_at TEXT`, () => {});
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // Admin-only visibility into who did what — signups, sign-ins, role changes, renames. Logged as
  // plain username strings (not a foreign key) because a log is a point-in-time record; it should
  // still read correctly after the actor renames themselves or, eventually, is removed.
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_username TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`);

  // Phase 1 of the NAS architecture migration (see docs/superpowers) — these five tables replace
  // the flat JSON files (profiles.json, devices.json, ai_history.json, notes_matrix.json,
  // vault_pins.json) that used to be VORLAN's only "database" for anything but user accounts.
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      username TEXT PRIMARY KEY,
      data TEXT NOT NULL DEFAULT '{}'
    )
  `);

  // Keyed by the user's stable numeric id, not username — a device's identity shouldn't change
  // just because its owner renamed themselves, and this table is written to on every
  // authenticated request (see auth.middleware.js), so it can't rely on a rename cascade running
  // in step with it the way profiles/notes/vault_pins safely do.
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      user_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      label TEXT,
      custom_label INTEGER NOT NULL DEFAULT 0,
      user_agent TEXT,
      ip TEXT,
      first_seen INTEGER,
      last_seen INTEGER,
      bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, device_id)
    )
  `);

  // Keyed by user id for the same reason as devices above: the original JSON version of this
  // store was keyed by username and was never cascaded on rename (account.service.js's cascade
  // list never included it), so a renamed user's chat history silently orphaned under their old
  // name. A stable id sidesteps that instead of adding another cascade step to get right.
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_history (
      user_id INTEGER PRIMARY KEY,
      sessions TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      owner_username TEXT,
      title TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_username)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS vault_pins (
      username TEXT PRIMARY KEY,
      pin_hash TEXT NOT NULL
    )
  `);

  // One row per signed-in browser or phone. A sign-in is only valid while its row is here, unrevoked
  // and unexpired, which is what lets an administrator (or the person) end it on the spot.
  // Refresh tokens are stored as SHA-256 hashes, never as the token itself; the previous hash is kept
  // for a short while so a token that has just been replaced can be told apart from a stolen one.
  // Times are epoch seconds.
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      device_id TEXT,
      refresh_hash TEXT NOT NULL,
      prev_refresh_hash TEXT,
      rotated_at INTEGER,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT,
      revoked_at INTEGER,
      revoked_reason TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);

  // A pool is a group of disks VORLAN treats as one storage area. On a single-disk machine there is
  // exactly one, created automatically the first time the server starts (see storagePools.service.js).
  db.run(`
    CREATE TABLE IF NOT EXISTS storage_pools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Which physical disks make up a pool, named by the volume identifier systeminformation reports
  // (e.g. "C:"). A disk is only ever added here by an explicit admin action.
  db.run(`
    CREATE TABLE IF NOT EXISTS storage_pool_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_id INTEGER NOT NULL,
      mount TEXT NOT NULL,
      added_at TEXT NOT NULL,
      UNIQUE(pool_id, mount)
    )
  `);

  // A dataset is one of VORLAN's own top-level folders, given a quota and a snapshot schedule of its
  // own. The key is fixed (matches DATASET_DEFS in storagePools.service.js) rather than autoincrement,
  // since datasets aren't created by admins in this phase - they're the folders VORLAN already has.
  db.run(`
    CREATE TABLE IF NOT EXISTS datasets (
      key TEXT PRIMARY KEY,
      pool_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      quota_bytes INTEGER,
      snapshots_enabled INTEGER NOT NULL DEFAULT 0,
      snapshot_frequency TEXT NOT NULL DEFAULT 'daily',
      snapshot_retain INTEGER NOT NULL DEFAULT 7,
      updated_at TEXT
    )
  `);

  // A snapshot is a full timestamped copy of a dataset's folder, kept under .snapshots/<key>/<folder_name>.
  // "pre-restore" snapshots are taken automatically right before a restore overwrites the live folder,
  // so a restore is itself always undoable.
  db.run(`
    CREATE TABLE IF NOT EXISTS dataset_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_key TEXT NOT NULL,
      taken_at TEXT NOT NULL,
      folder_name TEXT NOT NULL,
      bytes INTEGER,
      files INTEGER,
      kind TEXT NOT NULL CHECK(kind IN ('manual', 'scheduled', 'pre-restore')),
      created_by TEXT,
      status TEXT NOT NULL CHECK(status IN ('ok', 'failed')),
      note TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_key ON dataset_snapshots(dataset_key)`);

  // Whether a dataset is exported over SMB and/or NFS (Phase 7). Rows only exist for datasets that
  // are actually shareable — see SHAREABLE_KEYS in sharing.service.js, which deliberately excludes
  // "personal" (each user's PIN-locked vault would otherwise be readable by any other VORLAN
  // account signed in over SMB, since sharing has no concept of VORLAN's own per-file PIN gate).
  db.run(`
    CREATE TABLE IF NOT EXISTS dataset_shares (
      dataset_key TEXT PRIMARY KEY,
      smb_enabled INTEGER NOT NULL DEFAULT 0,
      nfs_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    )
  `);

  // Runs once — each table is only backfilled while it's still empty, so this is a no-op on
  // every boot after the first successful migration. The source JSON files are left in place
  // afterward, untouched, as a rollback safety net.
  require('./migrateJsonToDb')(db);
});

module.exports = db;
