const path = require('path');

// Every path is resolved from the backend project root, not from wherever a
// given module happens to live, so moving files around never breaks storage.
const ROOT_DIR = path.join(__dirname, '..', '..');
const SECURE_VAULT_DIR = path.join(ROOT_DIR, 'secure_vault');
const GLOBAL_MEDIA_DIR = path.join(SECURE_VAULT_DIR, 'media');
const PERSONAL_VAULT_DIR = path.join(SECURE_VAULT_DIR, 'personal');
// A real, navigable directory tree for the file explorer - separate from GLOBAL_MEDIA_DIR (flat,
// extension-bucketed storage the legacy gallery/music/documents views still read) so introducing
// actual folders here can't put a directory entry where that old flat reader expects only files.
const EXPLORER_DIR = path.join(SECURE_VAULT_DIR, 'explorer');

module.exports = {
  ROOT_DIR,
  SECURE_VAULT_DIR,
  GLOBAL_MEDIA_DIR,
  PERSONAL_VAULT_DIR,
  EXPLORER_DIR,
  NOTES_FILE: path.join(SECURE_VAULT_DIR, 'notes_matrix.json'),
  PROFILES_FILE: path.join(ROOT_DIR, 'profiles.json'),
  HISTORY_FILE: path.join(ROOT_DIR, 'ai_history.json'),
  PINS_FILE: path.join(PERSONAL_VAULT_DIR, 'vault_pins.json'),
  DB_FILE: path.join(ROOT_DIR, 'vorlan-secure.db'),
  DEVICES_FILE: path.join(ROOT_DIR, 'devices.json'),
};
