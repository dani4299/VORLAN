const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyToken, FILE_COOKIE, VAULT_COOKIE } = require('../middleware/auth.middleware');
const account = require('../services/account.service');
const sharing = require('../services/sharing.service');
const auditLog = require('../services/auditLog.service');
const sessions = require('../services/sessions.service');
const { loginByAccount, loginByAddress } = require('../services/rateLimiter.service');
const { setCookie, clearCookie } = require('../utils/cookies');
const { usernameProblem } = require('../utils/safeName');
const { ACCESS_TOKEN_TTL_SECONDS } = require('../config/constants');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;
// Compared against when the username doesn't exist, so a wrong name takes as long to reject as a wrong
// password and the timing doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('no-such-account-placeholder', 10);

const queryOne = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const execute = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});

const clientAddress = (req) => String(req.ip || '').replace(/^::ffff:/, '');
const clientContext = (req) => ({ deviceId: req.headers['x-device-id'] || null, ip: clientAddress(req), userAgent: req.headers['user-agent'] });
const minutesText = (seconds) => { const m = Math.ceil(seconds / 60); return m <= 1 ? 'a minute' : `${m} minutes`; };
const serverError = (res, err, message) => {
  console.error(message, err);
  return res.status(500).json({ error: message });
};

/** Sets the cookie a browser uses to load its own files; it lives exactly as long as the session can. */
const setFileCookie = (req, res, sessionId, expiresAt) => {
  const lifetime = expiresAt - Math.floor(Date.now() / 1000);
  setCookie(req, res, FILE_COOKIE, sessions.signFileToken(sessionId, lifetime), lifetime);
};

const tokenBody = (accessToken, refreshToken, user) => ({
  token: accessToken,
  refreshToken,
  expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  role: user.role,
  username: user.username,
});

router.post('/signup', async (req, res) => {
  // `role` is deliberately not accepted from the request body — a client used to be able to
  // simply POST { role: 'admin' } and self-grant administrator, which is exactly what the
  // frontend's signup form did, unconditionally, for every single signup.
  const { username, password, email, fullName } = req.body || {};

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Please enter a username, email, and password.' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  const nameProblem = usernameProblem(username);
  if (nameProblem) return res.status(400).json({ error: nameProblem });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // The very first account on a fresh install becomes the administrator — the same bootstrap
    // every real NAS setup wizard uses (Synology DSM, TrueNAS, ...). After that, signup can never
    // grant admin on its own; an existing admin has to promote someone in Control Panel.
    const { count } = await queryOne('SELECT COUNT(*) AS count FROM users', []);
    const userRole = count === 0 ? 'admin' : 'guest';

    try {
      const result = await execute(
        'INSERT INTO users (username, password, role, email, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, userRole, email, fullName || null, new Date().toISOString()]
      );
      auditLog.log(username, 'account.created', userRole === 'admin' ? 'first account on this install — granted administrator' : `role: ${userRole}`);
      sharing.syncSambaUser(username, password).catch(() => {});
      return res.status(201).json({ message: 'Account created.', userId: result.lastID, role: userRole });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed: users.username')) return res.status(409).json({ error: 'That username is already taken.' });
      if (err.message.includes('UNIQUE constraint failed: users.email')) return res.status(409).json({ error: 'That email is already registered.' });
      throw err;
    }
  } catch (error) {
    return serverError(res, error, 'Something went wrong creating your account.');
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Please enter your username and password.' });
  }

  const address = clientAddress(req);
  const accountKey = `${address}|${username.toLowerCase()}`;
  const wait = Math.max(loginByAccount.blocked(accountKey), loginByAddress.blocked(address));
  if (wait) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${minutesText(wait)}.`, code: 'rate_limited', retryAfter: wait });
  }

  try {
    const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
    const passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !passwordMatches) {
      auditLog.log(username, 'auth.login_failed', user ? 'wrong password' : 'no such account');
      if (loginByAccount.fail(accountKey)) auditLog.log(username, 'auth.login_blocked', `too many failed attempts from ${address}`);
      loginByAddress.fail(address);
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    loginByAccount.succeed(accountKey);
    const session = await sessions.create(user.id, clientContext(req));
    setFileCookie(req, res, session.id, session.expiresAt);
    auditLog.log(user.username, 'auth.login_success');
    return res.json({ message: 'Signed in.', ...tokenBody(sessions.signAccess(user, session.id), session.refreshToken, user) });
  } catch (err) {
    return serverError(res, err, 'Something went wrong signing you in.');
  }
});

// Trades a refresh token for a new pair. Called by the app itself when an access token has run out.
router.post('/refresh', async (req, res) => {
  try {
    const result = await sessions.refresh(req.body?.refreshToken, clientContext(req));
    if (!result.ok) {
      if (result.reuse) auditLog.log(result.reuse.username, 'auth.session_reuse_detected', 'a used-up refresh token was presented again; the sign-in was ended');
      if (result.code === 'session_ended') { clearCookie(req, res, FILE_COOKIE); clearCookie(req, res, VAULT_COOKIE); }
      return res.status(result.status).json({ error: result.message, code: result.code });
    }
    setFileCookie(req, res, result.sessionId, result.expiresAt);
    return res.json(tokenBody(result.accessToken, result.refreshToken, result.user));
  } catch (err) {
    return serverError(res, err, 'Something went wrong refreshing your sign-in.');
  }
});

// Deliberately not behind verifyToken: signing out has to work even when the access token has run out.
router.post('/logout', async (req, res) => {
  try {
    const header = req.headers.authorization;
    const sessionId = await sessions.sessionIdFromCredentials({
      accessToken: header && header.startsWith('Bearer ') ? header.slice(7) : null,
      refreshToken: req.body?.refreshToken,
    });
    if (sessionId && await sessions.revoke(sessionId, 'signed out')) {
      const row = await sessions.find(sessionId);
      auditLog.log(row?.username, 'auth.logout');
    }
  } catch (err) {
    console.error('Failed to sign out:', err);
  }
  clearCookie(req, res, FILE_COOKIE);
  clearCookie(req, res, VAULT_COOKIE);
  res.json({ message: 'Signed out.' });
});

router.post('/logout-all', verifyToken, async (req, res) => {
  try {
    const keepCurrent = req.body?.keepCurrent === true;
    const ended = await sessions.revokeForUser(req.user.id, { exceptSessionId: keepCurrent ? req.user.sid : null, reason: 'signed out everywhere by the account owner' });
    auditLog.log(req.user.username, 'auth.logout_all', `${ended} sign-in${ended === 1 ? '' : 's'} ended${keepCurrent ? ', this one kept' : ''}`);
    if (!keepCurrent) { clearCookie(req, res, FILE_COOKIE); clearCookie(req, res, VAULT_COOKIE); }
    res.json({ message: 'Signed out.', ended });
  } catch (err) {
    serverError(res, err, 'Failed to sign out.');
  }
});

router.get('/sessions', verifyToken, async (req, res) => {
  try {
    res.json({ sessions: await sessions.listForUser(req.user.id, req.user.sid) });
  } catch (err) {
    serverError(res, err, 'Failed to load your sign-ins.');
  }
});

router.delete('/sessions/:id', verifyToken, async (req, res) => {
  try {
    const target = await sessions.findForUser(req.params.id, req.user.id);
    if (!target || !(await sessions.revoke(target.id, 'ended by the account owner'))) return res.status(404).json({ error: 'That sign-in has already ended.' });
    auditLog.log(req.user.username, 'auth.session_revoked', target.device_id ? `device ${target.device_id}` : 'a sign-in');
    if (target.id === req.user.sid) { clearCookie(req, res, FILE_COOKIE); clearCookie(req, res, VAULT_COOKIE); }
    res.json({ message: 'Signed out.' });
  } catch (err) {
    serverError(res, err, 'Failed to end that sign-in.');
  }
});

router.get('/account', verifyToken, async (req, res) => {
  try {
    const row = await queryOne('SELECT username, email, full_name FROM users WHERE id = ?', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    res.json({ username: row.username, email: row.email, fullName: row.full_name });
  } catch (err) {
    serverError(res, err, 'Failed to load your account.');
  }
});

// Identity is resolved from the verified session (req.user.id), never from a client-supplied
// username, so this can only ever rename the caller's own account.
router.patch('/account', verifyToken, async (req, res) => {
  const { username, fullName } = req.body || {};

  try {
    const row = await queryOne('SELECT username FROM users WHERE id = ?', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Account not found.' });

    const oldUsername = row.username;
    const newUsername = typeof username === 'string' && username.trim() ? username.trim() : oldUsername;

    if (newUsername !== oldUsername) {
      const nameProblem = usernameProblem(newUsername);
      if (nameProblem) return res.status(400).json({ error: nameProblem });
      try {
        await execute('UPDATE users SET username = ? WHERE id = ?', [newUsername, req.user.id]);
      } catch (renameErr) {
        if (renameErr.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'That username is already taken.' });
        throw renameErr;
      }
      try {
        await account.renameUsernameEverywhere(oldUsername, newUsername);
      } catch (cascadeErr) {
        console.error('Username rename cascade error:', cascadeErr);
      }
      // Samba has no rename of its own, and only ever sees a plaintext password at the moment one is
      // set - which a rename doesn't carry. The old Samba account is removed; SMB access comes back
      // for the new name the next time this person sets a password (documented in installer/README.md).
      sharing.removeSambaUser(oldUsername).catch(() => {});
      auditLog.log(newUsername, 'account.renamed', `${oldUsername} -> ${newUsername}`);
    }

    if (fullName !== undefined) await execute('UPDATE users SET full_name = ? WHERE id = ?', [fullName, req.user.id]);

    const final = await queryOne('SELECT id, username, email, full_name, role FROM users WHERE id = ?', [req.user.id]);
    res.json({
      username: final.username,
      email: final.email,
      fullName: final.full_name,
      // The same session, with the new name in its token.
      token: sessions.signAccess(final, req.user.sid),
    });
  } catch (err) {
    serverError(res, err, 'Failed to update account.');
  }
});

router.post('/password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return res.status(400).json({ error: 'Enter your current password and a new one.' });
  if (newPassword.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.` });

  const key = `password|${req.user.id}`;
  const wait = loginByAccount.blocked(key);
  if (wait) return res.status(429).json({ error: `Too many failed attempts. Try again in ${minutesText(wait)}.`, code: 'rate_limited', retryAfter: wait });

  try {
    const row = await queryOne('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!row || !(await bcrypt.compare(currentPassword, row.password))) {
      loginByAccount.fail(key);
      return res.status(401).json({ error: 'Your current password is incorrect.' });
    }
    loginByAccount.succeed(key);
    await execute('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
    sharing.syncSambaUser(req.user.username, newPassword).catch(() => {});
    // A new password ends every other sign-in: whoever else was in with the old one is out.
    const ended = await sessions.revokeForUser(req.user.id, { exceptSessionId: req.user.sid, reason: 'password changed' });
    auditLog.log(req.user.username, 'account.password_changed', `${ended} other sign-in${ended === 1 ? '' : 's'} ended`);
    res.json({ message: 'Password changed.', ended });
  } catch (err) {
    serverError(res, err, 'Failed to change your password.');
  }
});

module.exports = router;
