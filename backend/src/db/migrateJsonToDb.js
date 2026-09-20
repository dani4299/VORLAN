const fs = require('fs');
const bcrypt = require('bcryptjs');
const {
  PROFILES_FILE, DEVICES_FILE, HISTORY_FILE, NOTES_FILE, PINS_FILE,
} = require('../config/paths');

const readJson = (file, fallback) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`Migration: couldn't parse ${file}, skipping it. (${err.message})`);
    return fallback;
  }
};

const isEmpty = (db, table) => new Promise((resolve, reject) => {
  db.get(`SELECT COUNT(*) AS count FROM ${table}`, (err, row) => {
    if (err) return reject(err);
    resolve(row.count === 0);
  });
});

const userIdFor = (db, username) => new Promise((resolve, reject) => {
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return reject(err);
    resolve(row ? row.id : null);
  });
});

/** One-time copy from VORLAN's original flat-file storage into the database. Each table's own
 * emptiness is the "already migrated?" check, so this is safe to call on every boot. */
module.exports = async function migrateJsonToDb(db) {
  try {
    if (await isEmpty(db, 'profiles')) {
      const profiles = readJson(PROFILES_FILE, {});
      for (const [username, entry] of Object.entries(profiles)) {
        // Legacy entries stored the pfp string directly instead of { pfp, wallpaper, ... }.
        const data = typeof entry === 'string' ? { pfp: entry } : entry;
        db.run('INSERT OR IGNORE INTO profiles (username, data) VALUES (?, ?)', [username, JSON.stringify(data)]);
      }
    }

    if (await isEmpty(db, 'devices')) {
      const allDevices = readJson(DEVICES_FILE, {});
      for (const [username, userDevices] of Object.entries(allDevices)) {
        const userId = await userIdFor(db, username);
        if (userId === null) continue; // device history for an account that no longer exists

        for (const [deviceId, d] of Object.entries(userDevices)) {
          db.run(
            `INSERT OR IGNORE INTO devices
               (user_id, device_id, label, custom_label, user_agent, ip, first_seen, last_seen, bytes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId, deviceId, d.label || null, d.customLabel ? 1 : 0,
              d.userAgent || null, d.ip || null, d.firstSeen || null, d.lastSeen || null, d.bytes || 0,
            ]
          );
        }
      }
    }

    if (await isEmpty(db, 'ai_history')) {
      const allHistory = readJson(HISTORY_FILE, {});
      for (const [username, sessions] of Object.entries(allHistory)) {
        const userId = await userIdFor(db, username);
        if (userId === null) continue; // history for an account that no longer exists
        db.run('INSERT OR IGNORE INTO ai_history (user_id, sessions) VALUES (?, ?)', [userId, JSON.stringify(sessions)]);
      }
    }

    if (await isEmpty(db, 'notes')) {
      const notes = readJson(NOTES_FILE, { global: [], personal: {} });
      for (const note of notes.global || []) {
        db.run(
          'INSERT OR IGNORE INTO notes (id, owner_username, title, text, timestamp) VALUES (?, NULL, ?, ?, ?)',
          [note.id, note.title || '', note.text || '', note.timestamp || new Date().toISOString()]
        );
      }
      for (const [username, list] of Object.entries(notes.personal || {})) {
        for (const note of list) {
          db.run(
            'INSERT OR IGNORE INTO notes (id, owner_username, title, text, timestamp) VALUES (?, ?, ?, ?, ?)',
            [note.id, username, note.title || '', note.text || '', note.timestamp || new Date().toISOString()]
          );
        }
      }
    }

    if (await isEmpty(db, 'vault_pins')) {
      const pins = readJson(PINS_FILE, {});
      for (const [username, pin] of Object.entries(pins)) {
        const hash = await bcrypt.hash(String(pin), 10);
        db.run('INSERT OR IGNORE INTO vault_pins (username, pin_hash) VALUES (?, ?)', [username, hash]);
      }
    }

    console.log('VORLAN: legacy JSON config migrated into the database.');
  } catch (err) {
    console.error('VORLAN: JSON-to-database migration failed:', err.message);
  }
};
