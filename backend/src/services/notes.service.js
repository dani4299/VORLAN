const fs = require('fs');
const { NOTES_FILE } = require('../config/paths');

let notes = fs.existsSync(NOTES_FILE)
  ? JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'))
  : { global: [], personal: {} };

const save = () => fs.writeFileSync(NOTES_FILE, JSON.stringify(notes));

/** Resolves which pool (global, or a user's private pool) a request targets. */
const getTarget = (req) => {
  const isPersonal = req.headers['x-personal'] === 'true';
  const user = req.headers['x-username'] || 'Ghost';
  if (isPersonal) {
    if (!notes.personal[user]) notes.personal[user] = [];
    return { list: notes.personal[user], isPersonal, user };
  }
  return { list: notes.global, isPersonal: false };
};

const list = (req) => getTarget(req).list;

const create = (req, { title, text }) => {
  const note = { id: Date.now(), title: title || '', text: text || '', timestamp: new Date().toISOString() };
  getTarget(req).list.unshift(note);
  save();
  return note;
};

const update = (req, id, { title, text }) => {
  const target = getTarget(req);
  const index = target.list.findIndex(n => n.id === id);
  if (index === -1) return null;
  if (title !== undefined) target.list[index].title = title;
  if (text !== undefined) target.list[index].text = text;
  save();
  return target.list[index];
};

const remove = (req, id) => {
  const target = getTarget(req);
  const remaining = target.list.filter(n => n.id !== id);
  if (target.isPersonal) {
    notes.personal[target.user] = remaining;
  } else {
    notes.global = remaining;
  }
  save();
};

const renameUser = (oldUsername, newUsername) => {
  if (!notes.personal[oldUsername]) return;
  notes.personal[newUsername] = notes.personal[oldUsername];
  delete notes.personal[oldUsername];
  save();
};

module.exports = { list, create, update, remove, renameUser };
