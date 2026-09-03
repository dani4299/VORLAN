const fs = require('fs');
const { PERSONAL_VAULT_DIR, PINS_FILE } = require('../config/paths');

if (!fs.existsSync(PERSONAL_VAULT_DIR)) {
  fs.mkdirSync(PERSONAL_VAULT_DIR, { recursive: true });
}

let pins = fs.existsSync(PINS_FILE) ? JSON.parse(fs.readFileSync(PINS_FILE, 'utf8')) : {};

const save = () => fs.writeFileSync(PINS_FILE, JSON.stringify(pins));

const hasPin = (username) => !!pins[username];

/** Creates the PIN on first use, otherwise verifies it. Mirrors the original behavior. */
const verifyOrSet = (username, pin) => {
  if (!pins[username]) {
    pins[username] = pin;
    save();
    return { success: true };
  }
  if (pins[username] === pin) {
    return { success: true };
  }
  return { success: false };
};

const renameUser = (oldUsername, newUsername) => {
  if (pins[oldUsername] === undefined) return;
  pins[newUsername] = pins[oldUsername];
  delete pins[oldUsername];
  save();
};

module.exports = { hasPin, verifyOrSet, renameUser };
