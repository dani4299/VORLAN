const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Spin up the local database file (offline-first FTW)
const dbPath = path.join(__dirname, 'vorlan-secure.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Vault breach: Database failed to spin up 💀', err.message);
  } else {
    console.log('VORLAN Secure Vault Database connected successfully. 🔒');
  }
});

// Initialize the table structure
db.serialize(() => {
  // We use CHECK to strictly enforce that a user can ONLY be one of these three roles
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT CHECK(role IN ('admin', 'employee', 'guest')) DEFAULT 'guest'
    )
  `);
});

module.exports = db;