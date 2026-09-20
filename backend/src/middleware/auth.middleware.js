const sessions = require('../services/sessions.service');
const { parseCookies, setCookie } = require('../utils/cookies');
const { VAULT_UNLOCK_SECONDS } = require('../config/constants');

const FILE_COOKIE = 'vorlan_files';
const VAULT_COOKIE = 'vorlan_vault';

const bearerToken = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice(7) : null;
};

const deny = (res, failure) => res.status(failure.status).json({ error: failure.message, code: failure.code });

const fail = (res, err) => {
  console.error('Failed to verify sign-in:', err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

/**
 * Requires a valid access token in the Authorization header, and the session behind it to still be
 * live. The person's name and role are read from the database, so deleting or demoting an account, or
 * ending its session, takes effect on the very next request.
 */
const verifyToken = async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Access denied. Please sign in.', code: 'no_token' });
  try {
    const result = await sessions.authenticate(token);
    if (!result.ok) return deny(res, result);
    req.user = result.user;
    return next();
  } catch (err) {
    return fail(res, err);
  }
};

/**
 * For routes a browser opens by itself (an image, a song, a download link) and so can't send a header:
 * the Authorization header if there is one, otherwise the sign-in's file cookie. Use it on safe (GET)
 * routes only; it is never accepted anywhere that changes something.
 */
const verifyTokenOrFileCookie = async (req, res, next) => {
  if (bearerToken(req)) return verifyToken(req, res, next);
  const cookie = parseCookies(req.headers.cookie)[FILE_COOKIE];
  if (!cookie) return res.status(401).json({ error: 'Access denied. Please sign in.', code: 'no_token' });
  try {
    const result = await sessions.authenticateFileToken(cookie);
    if (!result.ok) return deny(res, result);
    req.user = result.user;
    return next();
  } catch (err) {
    return fail(res, err);
  }
};

/** Chain after verifyToken: the Personal Vault must have been unlocked with the PIN, on this sign-in, recently. */
const requireVault = (req, res, next) => {
  const cookie = parseCookies(req.headers.cookie)[VAULT_COOKIE];
  if (!sessions.vaultUnlockedFor(cookie, req.user)) {
    return res.status(403).json({ error: 'Unlock your Personal Vault with your PIN first.', code: 'vault_locked' });
  }
  // Each use of the vault keeps it open a little longer; leaving it alone lets it lock itself.
  setCookie(req, res, VAULT_COOKIE, sessions.signVaultToken(req.user), VAULT_UNLOCK_SECONDS);
  return next();
};

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.verifyTokenOrFileCookie = verifyTokenOrFileCookie;
module.exports.requireVault = requireVault;
module.exports.FILE_COOKIE = FILE_COOKIE;
module.exports.VAULT_COOKIE = VAULT_COOKIE;
