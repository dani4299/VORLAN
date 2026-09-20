const db = require('../db');

const get = (username) => new Promise((resolve, reject) => {
  db.get('SELECT data FROM profiles WHERE username = ?', [username], (err, row) => {
    if (err) return reject(err);
    resolve(row ? JSON.parse(row.data) : {});
  });
});

const update = async (username, patch) => {
  const merged = { ...(await get(username)), ...patch };
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO profiles (username, data) VALUES (?, ?)
       ON CONFLICT(username) DO UPDATE SET data = excluded.data`,
      [username, JSON.stringify(merged)],
      (err) => (err ? reject(err) : resolve())
    );
  });
  return merged;
};

const renameUser = (oldUsername, newUsername) => new Promise((resolve, reject) => {
  db.run('UPDATE profiles SET username = ? WHERE username = ?', [newUsername, oldUsername], (err) => (err ? reject(err) : resolve()));
});

module.exports = { get, update, renameUser };
