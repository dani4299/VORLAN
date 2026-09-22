const bcrypt = require('bcryptjs');
const db = require('../db');
const sessions = require('./sessions.service');
const sharing = require('./sharing.service');
const { usernameProblem } = require('../utils/safeName');

const ROLES = ['admin', 'employee', 'guest'];
const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An error the route can show as-is: `status` is the HTTP code, `message` is written for the person. */
const problem = (status, message) => Object.assign(new Error(message), { status });

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const checkPassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw problem(400, `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
};

const createUser = async ({ username, password, email, fullName, role }) => {
  const name = typeof username === 'string' ? username.trim() : '';
  const mail = typeof email === 'string' ? email.trim() : '';
  const nameProblem = usernameProblem(name);
  if (nameProblem) throw problem(400, nameProblem);
  if (!EMAIL.test(mail)) throw problem(400, 'Enter a valid email address.');
  if (!ROLES.includes(role)) throw problem(400, 'Role must be admin, employee, or guest.');
  checkPassword(password);

  try {
    const result = await run(
      'INSERT INTO users (username, password, role, email, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [name, await bcrypt.hash(password, 10), role, mail, (fullName || '').trim() || null, new Date().toISOString()]
    );
    sharing.syncSambaUser(name, password).catch(() => {});
    return { id: result.lastID, username: name, role };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: users.username')) throw problem(409, 'That username is already taken.');
    if (err.message.includes('UNIQUE constraint failed: users.email')) throw problem(409, 'That email is already registered.');
    throw err;
  }
};

const resetPassword = async (id, password) => {
  checkPassword(password);
  const target = await get('SELECT id, username FROM users WHERE id = ?', [id]);
  if (!target) throw problem(404, 'That account no longer exists.');
  await run('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(password, 10), id]);
  sharing.syncSambaUser(target.username, password).catch(() => {});
  // Whoever was signed in with the old password is signed out: that is usually the reason for a reset.
  const signedOut = await sessions.revokeForUser(id, { reason: 'password reset by an administrator' });
  return { ...target, signedOut };
};

/**
 * Removes an account and the records that belong to it. Files the person uploaded to the shared
 * folders, and their personal-vault files on disk, are kept: deleting an account shouldn't silently
 * destroy data the admin may still need.
 */
const deleteUser = async (id, actorId) => {
  const target = await get('SELECT id, username, role FROM users WHERE id = ?', [id]);
  if (!target) throw problem(404, 'That account no longer exists.');
  if (target.id === actorId) throw problem(409, "You can't delete the account you're signed in with.");
  if (target.role === 'admin') {
    const { count } = await get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    if (count <= 1) throw problem(409, "That's the only administrator, so it can't be deleted.");
  }

  // The account row goes first: from that moment its sign-ins stop working, even if a later cleanup step fails.
  await run('DELETE FROM users WHERE id = ?', [id]);
  sharing.removeSambaUser(target.username).catch(() => {});
  await Promise.all([
    run('DELETE FROM profiles WHERE username = ?', [target.username]),
    run('DELETE FROM notes WHERE owner_username = ?', [target.username]),
    run('DELETE FROM vault_pins WHERE username = ?', [target.username]),
    run('DELETE FROM devices WHERE user_id = ?', [id]),
    sessions.deleteForUser(id),
    run('DELETE FROM ai_history WHERE user_id = ?', [id]),
  ]);
  return target;
};

module.exports = { createUser, resetPassword, deleteUser, ROLES };
