const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT_DIR } = require('./paths');

// Everything secret lives in one private folder (default: backend/secrets, never committed): the
// key that signs sign-in tokens, and the HTTPS certificate and its key. Nothing secret is checked in
// or hardcoded; the first start of a fresh install generates what it needs.
const SECRETS_DIR = process.env.VORLAN_SECRETS_DIR || path.join(ROOT_DIR, 'secrets');

const ensureDir = () => fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });

const read = (name) => {
  try {
    return fs.readFileSync(path.join(SECRETS_DIR, name), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
};

/** Writes atomically (a half-written key file would lock everyone out) and readable by this account only. */
const writePrivate = (name, content) => {
  ensureDir();
  const target = path.join(SECRETS_DIR, name);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, content, { mode: 0o600 });
  fs.renameSync(temp, target);
};

const MIN_SECRET_LENGTH = 32;
let jwtSecret = null; // { value, source }

/**
 * The key sign-in tokens are signed with. From the JWT_SECRET environment variable if one is set
 * (it must be long enough to mean something); otherwise a random one generated on first use and
 * kept in secrets/jwt.secret. There is no default value to fall back to.
 */
const getJwtSecret = () => {
  if (jwtSecret) return jwtSecret.value;

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    if (fromEnv.length < MIN_SECRET_LENGTH) throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long.`);
    jwtSecret = { value: fromEnv, source: 'environment' };
    return jwtSecret.value;
  }

  const stored = read('jwt.secret')?.trim();
  if (stored && stored.length >= MIN_SECRET_LENGTH * 2) {
    jwtSecret = { value: stored, source: 'file' };
    return jwtSecret.value;
  }

  const created = crypto.randomBytes(48).toString('hex');
  writePrivate('jwt.secret', `${created}\n`);
  jwtSecret = { value: created, source: 'generated' };
  return jwtSecret.value;
};

const describeJwtSecret = () => {
  getJwtSecret();
  return { source: jwtSecret.source, location: jwtSecret.source === 'environment' ? 'the JWT_SECRET environment variable' : path.join(SECRETS_DIR, 'jwt.secret') };
};

module.exports = { SECRETS_DIR, read, writePrivate, getJwtSecret, describeJwtSecret };
