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
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
});

module.exports = db;
