const fs = require('fs');
const { PROFILES_FILE } = require('../config/paths');

let profiles = fs.existsSync(PROFILES_FILE) ? JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')) : {};

/** Legacy entries stored the pfp string directly; normalize those to the {pfp, wallpaper} shape. */
const get = (username) => {
  const entry = profiles[username];
  if (!entry) return {};
  return typeof entry === 'string' ? { pfp: entry } : entry;
};

const update = (username, patch) => {
  profiles[username] = { ...get(username), ...patch };
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles));
};

const renameUser = (oldUsername, newUsername) => {
  if (profiles[oldUsername] === undefined) return;
  profiles[newUsername] = profiles[oldUsername];
  delete profiles[oldUsername];
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles));
};

module.exports = { get, update, renameUser };
