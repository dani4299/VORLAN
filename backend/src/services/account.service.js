const fs = require('fs');
const path = require('path');
const { PERSONAL_VAULT_DIR } = require('../config/paths');
const profiles = require('./profiles.service');
const notes = require('./notes.service');
const vaultPins = require('./vaultPins.service');

/** Personal vault filenames are prefixed `${username}_`, so a rename has to touch disk too. */
const renamePersonalVaultFiles = (oldUsername, newUsername) => {
  if (!fs.existsSync(PERSONAL_VAULT_DIR)) return;
  const prefix = `${oldUsername}_`;
  for (const name of fs.readdirSync(PERSONAL_VAULT_DIR)) {
    if (!name.startsWith(prefix)) continue;
    const newName = `${newUsername}_${name.slice(prefix.length)}`;
    fs.renameSync(path.join(PERSONAL_VAULT_DIR, name), path.join(PERSONAL_VAULT_DIR, newName));
  }
};

/** The username doubles as a storage key across profiles, notes, vault pins, and personal vault
 * filenames — a rename has to cascade through all of them or data silently orphans. (Devices are
 * keyed by the user's stable id instead, precisely to avoid needing to be in this list.) */
const renameUsernameEverywhere = async (oldUsername, newUsername) => {
  await Promise.all([
    profiles.renameUser(oldUsername, newUsername),
    notes.renameUser(oldUsername, newUsername),
    vaultPins.renameUser(oldUsername, newUsername),
  ]);
  renamePersonalVaultFiles(oldUsername, newUsername);
};

module.exports = { renameUsernameEverywhere };
