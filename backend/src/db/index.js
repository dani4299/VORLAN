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

  // Runs once — each table is only backfilled while it's still empty, so this is a no-op on
  // every boot after the first successful migration. The source JSON files are left in place
  // afterward, untouched, as a rollback safety net.
  require('./migrateJsonToDb')(db);
});

module.exports = db;
