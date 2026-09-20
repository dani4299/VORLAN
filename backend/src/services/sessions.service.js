const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { getJwtSecret } = require('../config/secrets');
const {
  ACCESS_TOKEN_TTL_SECONDS, REFRESH_TTL_SECONDS, SESSION_MAX_SECONDS, REFRESH_GRACE_SECONDS, VAULT_UNLOCK_SECONDS,
} = require('../config/constants');

const now = () => Math.floor(Date.now() / 1000);
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const ALGORITHMS = ['HS256'];
const LAST_USED_WRITE_INTERVAL = 60; // seconds; a session's "last active" is kept to the minute, not written on every request

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

/** A failure the routes can turn straight into a response. `code` is what the frontend keys on. */
const failure = (status, code, message) => ({ ok: false, status, code, message });

const newRefreshToken = (sessionId) => `${sessionId}.${crypto.randomBytes(32).toString('base64url')}`;
const sessionIdOf = (refreshToken) => {
  if (typeof refreshToken !== 'string') return null;
  const dot = refreshToken.indexOf('.');
  return dot > 0 ? refreshToken.slice(0, dot) : null;
};

// ---------------------------------------------------------------- tokens

const signAccess = (user, sessionId) => jwt.sign(
  { typ: 'access', id: user.id, username: user.username, role: user.role, sid: sessionId },
  getJwtSecret(),
  { algorithm: ALGORITHMS[0], expiresIn: ACCESS_TOKEN_TTL_SECONDS }
);

/**
 * The cookie that lets a browser load its own files (<img>, <audio>, a download link) - things that
 * can't send an Authorization header. It only names a session, so it dies the moment the session does.
 */
const signFileToken = (sessionId, lifetimeSeconds) => jwt.sign(
  { typ: 'file', sid: sessionId },
  getJwtSecret(),
  { algorithm: ALGORITHMS[0], expiresIn: Math.max(60, lifetimeSeconds) }
);

const signVaultToken = (user, lifetimeSeconds = VAULT_UNLOCK_SECONDS) => jwt.sign(
  { typ: 'vault', id: user.id, sid: user.sid },
  getJwtSecret(),
  { algorithm: ALGORITHMS[0], expiresIn: lifetimeSeconds }
);

const verifyTyped = (token, typ) => {
  try {
    const claims = jwt.verify(token, getJwtSecret(), { algorithms: ALGORITHMS });
    if (claims.typ !== typ || typeof claims.sid !== 'string') return { error: failure(401, 'session_ended', 'Please sign in again.') };
    return { claims };
  } catch (err) {
    if (err.name === 'TokenExpiredError') return { error: failure(401, 'token_expired', 'Your sign-in needs refreshing.') };
    return { error: failure(401, 'session_ended', 'Please sign in again.') };
  }
};

// ---------------------------------------------------------------- sessions

const LOOKUP = `SELECT s.*, u.username AS username, u.role AS role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`;

/** The session, if it can still be used: exists, its account exists, not revoked, not expired. */
const usableSession = async (sessionId) => {
  const row = await get(LOOKUP, [sessionId]);
  if (!row) return { error: failure(401, 'session_ended', 'This account or session no longer exists.') };
  if (row.revoked_at) return { error: failure(401, 'session_ended', 'You were signed out. Please sign in again.') };
  const t = now();
  if (row.expires_at <= t || row.created_at + SESSION_MAX_SECONDS <= t) return { error: failure(401, 'session_ended', 'Your session has expired. Please sign in again.') };
  return { row };
};

const touch = (row) => {
  const t = now();
  if (t - row.last_used_at >= LAST_USED_WRITE_INTERVAL) {
    run('UPDATE sessions SET last_used_at = ? WHERE id = ?', [t, row.id]).catch(() => {});
  }
};

const asUser = (row) => ({ id: row.user_id, username: row.username, role: row.role, sid: row.id });

const create = async (userId, { deviceId, ip, userAgent } = {}) => {
  const id = crypto.randomUUID();
  const refreshToken = newRefreshToken(id);
  const t = now();
  await run(
    `INSERT INTO sessions (id, user_id, device_id, refresh_hash, created_at, last_used_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, deviceId || null, sha256(refreshToken), t, t, Math.min(t + REFRESH_TTL_SECONDS, t + SESSION_MAX_SECONDS), ip || null, userAgent ? String(userAgent).slice(0, 300) : null]
  );
  return { id, refreshToken, expiresAt: Math.min(t + REFRESH_TTL_SECONDS, t + SESSION_MAX_SECONDS) };
};

/** Checks an access token and the session behind it. Resolves { ok: true, user } or a failure. */
const authenticate = async (accessToken) => {
  const { claims, error } = verifyTyped(accessToken, 'access');
  if (error) return error;
  const { row, error: sessionError } = await usableSession(claims.sid);
  if (sessionError) return sessionError;
  touch(row);
  // Identity and role come from the database, never from the token: a demoted or renamed account is
  // seen as such on its very next request.
  return { ok: true, user: asUser(row) };
};

/** Same, for the cookie a browser sends when it loads a file. */
const authenticateFileToken = async (fileToken) => {
  const { claims, error } = verifyTyped(fileToken, 'file');
  if (error) return error;
  const { row, error: sessionError } = await usableSession(claims.sid);
  if (sessionError) return sessionError;
  return { ok: true, user: asUser(row) };
};

/** True when `vaultToken` is this person's, on this session, and not expired. */
const vaultUnlockedFor = (vaultToken, user) => {
  if (!vaultToken) return false;
  try {
    const claims = jwt.verify(vaultToken, getJwtSecret(), { algorithms: ALGORITHMS });
    return claims.typ === 'vault' && claims.id === user.id && claims.sid === user.sid;
  } catch {
    return false;
  }
};

/**
 * Trades a refresh token for a new pair. Every use replaces the token, so each one works once. A token
 * that was just replaced and shows up again within the grace window is a race (two tabs), answered with
 * a conflict the client retries; the same token turning up later is what a thief holding a copy looks
 * like, so the whole session is ended.
 */
const refresh = async (refreshToken, { ip, userAgent } = {}) => {
  const sessionId = sessionIdOf(refreshToken);
  if (!sessionId) return failure(401, 'session_ended', 'Please sign in again.');

  const { row, error } = await usableSession(sessionId);
  if (error) return error;

  const presented = sha256(refreshToken);
  const t = now();

  if (sameHash(presented, row.refresh_hash)) {
    const next = newRefreshToken(row.id);
    const expiresAt = Math.min(t + REFRESH_TTL_SECONDS, row.created_at + SESSION_MAX_SECONDS);
    const result = await run(
      `UPDATE sessions SET refresh_hash = ?, prev_refresh_hash = ?, rotated_at = ?, last_used_at = ?, expires_at = ?, ip = COALESCE(?, ip), user_agent = COALESCE(?, user_agent)
        WHERE id = ? AND refresh_hash = ? AND revoked_at IS NULL`,
      [sha256(next), row.refresh_hash, t, t, expiresAt, ip || null, userAgent ? String(userAgent).slice(0, 300) : null, row.id, row.refresh_hash]
    );
    // Someone else rotated between our read and our write: this caller lost the race.
    if (result.changes === 0) return failure(409, 'refresh_conflict', 'Another window just refreshed the sign-in. Try again.');
    const user = asUser(row);
    return { ok: true, user, sessionId: row.id, accessToken: signAccess(user, row.id), refreshToken: next, expiresAt };
  }

  if (row.prev_refresh_hash && sameHash(presented, row.prev_refresh_hash)) {
    if (row.rotated_at && t - row.rotated_at <= REFRESH_GRACE_SECONDS) {
      return failure(409, 'refresh_conflict', 'Another window just refreshed the sign-in. Try again.');
    }
    await revoke(row.id, 'refresh token reused');
    return { ...failure(401, 'session_ended', 'This sign-in was used from two places and has been ended for safety. Please sign in again.'), reuse: { sessionId: row.id, userId: row.user_id, username: row.username } };
  }

  return failure(401, 'session_ended', 'Please sign in again.');
};

const revoke = async (sessionId, reason = 'signed out') => {
  const result = await run('UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL', [now(), reason, sessionId]);
  return result.changes > 0;
};

/** Ends every live session of one account (optionally sparing the one making the request). Resolves how many ended. */
const revokeForUser = async (userId, { exceptSessionId = null, reason = 'signed out everywhere' } = {}) => {
  const result = await run(
    'UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?',
    [now(), reason, userId, exceptSessionId || '']
  );
  return result.changes;
};

const revokeForDevice = async (userId, deviceId, reason = 'signed out by an administrator') => {
  const result = await run(
    'UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL',
    [now(), reason, userId, deviceId]
  );
  return result.changes;
};

const deleteForUser = (userId) => run('DELETE FROM sessions WHERE user_id = ?', [userId]);

// "Still usable": not revoked, not idle-expired, not past its absolute lifetime.
const ACTIVE = 'revoked_at IS NULL AND expires_at > ? AND created_at + ? > ?';
const ACTIVE_ALIASED = 's.revoked_at IS NULL AND s.expires_at > ? AND s.created_at + ? > ?';
const activeParams = () => [now(), SESSION_MAX_SECONDS, now()];

const publicRow = (r, currentSessionId) => ({
  id: r.id,
  userId: r.user_id,
  username: r.username,
  deviceId: r.device_id,
  deviceLabel: r.device_label || null,
  ip: r.ip,
  userAgent: r.user_agent,
  createdAt: r.created_at * 1000,
  lastUsedAt: r.last_used_at * 1000,
  expiresAt: r.expires_at * 1000,
  current: r.id === currentSessionId,
});

const SELECT_WITH_DEVICE = `
  SELECT s.*, u.username AS username, d.label AS device_label
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN devices d ON d.user_id = s.user_id AND d.device_id = s.device_id`;

const listForUser = async (userId, currentSessionId) => {
  const rows = await all(`${SELECT_WITH_DEVICE} WHERE s.user_id = ? AND ${ACTIVE_ALIASED} ORDER BY s.last_used_at DESC`, [userId, ...activeParams()]);
  return rows.map((r) => publicRow(r, currentSessionId));
};

const listAll = async () => {
  const rows = await all(`${SELECT_WITH_DEVICE} WHERE ${ACTIVE_ALIASED} ORDER BY s.last_used_at DESC`, activeParams());
  return rows.map((r) => publicRow(r, null));
};

const findForUser = (sessionId, userId) => get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
const find = (sessionId) => get('SELECT s.*, u.username AS username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', [sessionId]);

const countActive = async () => (await get(`SELECT COUNT(*) AS n FROM sessions WHERE ${ACTIVE}`, activeParams())).n;

/** Rows that can never be used again are dropped a week after they stop mattering, so the table stays small. */
const purge = () => run('DELETE FROM sessions WHERE (revoked_at IS NOT NULL AND revoked_at < ?) OR expires_at < ?', [now() - 7 * 86400, now() - 7 * 86400]);

/**
 * The session that signing out should end, given whatever the client still has. A valid-signature access
 * token (even an expired one) names its session; a refresh token counts only if it is the real one (or the
 * one it just replaced), so knowing a session's id is never enough to end it.
 */
const sessionIdFromCredentials = async ({ accessToken, refreshToken }) => {
  if (accessToken) {
    try {
      const claims = jwt.verify(accessToken, getJwtSecret(), { algorithms: ALGORITHMS, ignoreExpiration: true });
      if (claims.typ === 'access' && typeof claims.sid === 'string') return claims.sid;
    } catch { /* a forged token names no session */ }
  }
  const sessionId = sessionIdOf(refreshToken);
  if (!sessionId) return null;
  const row = await get('SELECT refresh_hash, prev_refresh_hash FROM sessions WHERE id = ?', [sessionId]);
  if (!row) return null;
  const presented = sha256(refreshToken);
  return sameHash(presented, row.refresh_hash) || sameHash(presented, row.prev_refresh_hash) ? sessionId : null;
};

module.exports = {
  create, authenticate, authenticateFileToken, refresh, revoke, revokeForUser, revokeForDevice, deleteForUser,
  signAccess, signFileToken, signVaultToken, vaultUnlockedFor, listForUser, listAll, find, findForUser, countActive, purge,
  sessionIdFromCredentials,
};
