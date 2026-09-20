const bcrypt = require('bcryptjs');
const db = require('../db');

const hasPin = (username) => new Promise((resolve, reject) => {
  db.get('SELECT 1 FROM vault_pins WHERE username = ?', [username], (err, row) => {
    if (err) return reject(err);
    resolve(!!row);
  });
});

/** Creates the PIN (hashed) on first use, otherwise verifies it against the stored hash. Mirrors the original behavior. */
const verifyOrSet = (username, pin) => new Promise((resolve, reject) => {
  db.get('SELECT pin_hash FROM vault_pins WHERE username = ?', [username], async (err, row) => {
    if (err) return reject(err);
    try {
      if (!row) {
        const hash = await bcrypt.hash(String(pin), 10);
        db.run('INSERT INTO vault_pins (username, pin_hash) VALUES (?, ?)', [username, hash], (insertErr) => {
          if (insertErr) return reject(insertErr);
          resolve({ success: true });
        });
        return;
      }
      resolve({ success: await bcrypt.compare(String(pin), row.pin_hash) });
    } catch (hashErr) {
      reject(hashErr);
    }
  });
});

const renameUser = (oldUsername, newUsername) => new Promise((resolve, reject) => {
  db.run('UPDATE vault_pins SET username = ? WHERE username = ?', [newUsername, oldUsername], (err) => (err ? reject(err) : resolve()));
});

module.exports = { hasPin, verifyOrSet, renameUser };
