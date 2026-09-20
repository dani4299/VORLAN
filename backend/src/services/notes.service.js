const db = require('../db');

/** Resolves which pool (global, or a user's private pool) a request targets. */
const getOwner = (req) => {
  const isPersonal = req.headers['x-personal'] === 'true';
  return isPersonal ? (req.headers['x-username'] || 'Ghost') : null;
};

const rowToNote = (r) => ({ id: r.id, title: r.title, text: r.text, timestamp: r.timestamp });

const list = (req) => new Promise((resolve, reject) => {
  const owner = getOwner(req);
  const sql = owner === null
    ? 'SELECT * FROM notes WHERE owner_username IS NULL ORDER BY id DESC'
    : 'SELECT * FROM notes WHERE owner_username = ? ORDER BY id DESC';
  db.all(sql, owner === null ? [] : [owner], (err, rows) => {
    if (err) return reject(err);
    resolve(rows.map(rowToNote));
  });
});

const create = (req, { title, text }) => new Promise((resolve, reject) => {
  const owner = getOwner(req);
  const note = { id: Date.now(), title: title || '', text: text || '', timestamp: new Date().toISOString() };
  db.run(
    'INSERT INTO notes (id, owner_username, title, text, timestamp) VALUES (?, ?, ?, ?, ?)',
    [note.id, owner, note.title, note.text, note.timestamp],
    (err) => (err ? reject(err) : resolve(note))
  );
});

const update = (req, id, { title, text }) => new Promise((resolve, reject) => {
  const owner = getOwner(req);
  const selectSql = owner === null
    ? 'SELECT * FROM notes WHERE id = ? AND owner_username IS NULL'
    : 'SELECT * FROM notes WHERE id = ? AND owner_username = ?';
  db.get(selectSql, owner === null ? [id] : [id, owner], (err, row) => {
    if (err) return reject(err);
    if (!row) return resolve(null);

    const newTitle = title !== undefined ? title : row.title;
    const newText = text !== undefined ? text : row.text;
    db.run('UPDATE notes SET title = ?, text = ? WHERE id = ?', [newTitle, newText, id], (updateErr) => {
      if (updateErr) return reject(updateErr);
      resolve({ id: row.id, title: newTitle, text: newText, timestamp: row.timestamp });
    });
  });
});

const remove = (req, id) => new Promise((resolve, reject) => {
  const owner = getOwner(req);
  const sql = owner === null
    ? 'DELETE FROM notes WHERE id = ? AND owner_username IS NULL'
    : 'DELETE FROM notes WHERE id = ? AND owner_username = ?';
  db.run(sql, owner === null ? [id] : [id, owner], (err) => (err ? reject(err) : resolve()));
});

const renameUser = (oldUsername, newUsername) => new Promise((resolve, reject) => {
  db.run('UPDATE notes SET owner_username = ? WHERE owner_username = ?', [newUsername, oldUsername], (err) => (err ? reject(err) : resolve()));
});

module.exports = { list, create, update, remove, renameUser };
