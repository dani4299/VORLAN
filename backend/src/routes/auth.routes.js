const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const verifyToken = require('../middleware/auth.middleware');
const account = require('../services/account.service');
const auditLog = require('../services/auditLog.service');
const { JWT_SECRET, JWT_EXPIRY } = require('../config/constants');

const router = express.Router();

router.post('/signup', async (req, res) => {
  // `role` is deliberately not accepted from the request body — a client used to be able to
  // simply POST { role: 'admin' } and self-grant administrator, which is exactly what the
  // frontend's signup form did, unconditionally, for every single signup.
  const { username, password, email, fullName } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Please enter a username, email, and password.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // The very first account on a fresh install becomes the administrator — the same bootstrap
    // every real NAS setup wizard uses (Synology DSM, TrueNAS, ...). After that, signup can never
    // grant admin on its own; an existing admin has to promote someone from System State.
    const userCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) AS count FROM users', (err, row) => (err ? reject(err) : resolve(row.count)));
    });
    const userRole = userCount === 0 ? 'admin' : 'guest';

    db.run(
      'INSERT INTO users (username, password, role, email, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, userRole, email, fullName || null, new Date().toISOString()],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(409).json({ error: 'That username is already taken.' });
          }
          if (err.message.includes('UNIQUE constraint failed: users.email')) {
            return res.status(409).json({ error: 'That email is already registered.' });
          }
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Something went wrong creating your account.' });
        }

        auditLog.log(username, 'account.created', userRole === 'admin' ? 'first account on this install — granted administrator' : `role: ${userRole}`);

        res.status(201).json({
          message: 'Account created.',
          userId: this.lastID,
          role: userRole,
        });
      }
    );
  } catch (error) {
    console.error('Hashing error:', error);
    res.status(500).json({ error: 'Something went wrong creating your account.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter your username and password.' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Something went wrong signing you in.' });
    }

    if (!user) {
      auditLog.log(username, 'auth.login_failed', 'no such account');
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      auditLog.log(username, 'auth.login_failed', 'wrong password');
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    auditLog.log(user.username, 'auth.login_success');

    res.json({
      message: 'Signed in.',
      token,
      role: user.role,
    });
  });
});

router.get('/account', verifyToken, (req, res) => {
  db.get('SELECT username, email, full_name FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Account not found.' });
    res.json({ username: row.username, email: row.email, fullName: row.full_name });
  });
});

// Identity is resolved from the verified token (req.user.id), never from a client-supplied
// username, so this can only ever rename the caller's own account.
router.patch('/account', verifyToken, (req, res) => {
  const { username, fullName } = req.body;

  db.get('SELECT username FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Account not found.' });

    const oldUsername = row.username;
    const newUsername = username && username.trim() ? username.trim() : oldUsername;

    const finish = () => {
      db.get('SELECT username, email, full_name, role FROM users WHERE id = ?', [req.user.id], (finalErr, finalRow) => {
        if (finalErr || !finalRow) return res.status(500).json({ error: 'Failed to load updated account.' });
        const token = jwt.sign(
          { id: req.user.id, username: finalRow.username, role: finalRow.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        res.json({ username: finalRow.username, email: finalRow.email, fullName: finalRow.full_name, token });
      });
    };

    const applyFullName = () => {
      if (fullName === undefined) return finish();
      db.run('UPDATE users SET full_name = ? WHERE id = ?', [fullName, req.user.id], (fnErr) => {
        if (fnErr) {
          console.error('Failed to update full name:', fnErr);
          return res.status(500).json({ error: 'Failed to update account.' });
        }
        finish();
      });
    };

    if (newUsername === oldUsername) {
      return applyFullName();
    }

    db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, req.user.id], async (renameErr) => {
      if (renameErr) {
        if (renameErr.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'That username is already taken.' });
        }
        console.error('Failed to rename username:', renameErr);
        return res.status(500).json({ error: 'Failed to update username.' });
      }

      try {
        await account.renameUsernameEverywhere(oldUsername, newUsername);
      } catch (cascadeErr) {
        console.error('Username rename cascade error:', cascadeErr);
      }

      auditLog.log(newUsername, 'account.renamed', `${oldUsername} -> ${newUsername}`);

      applyFullName();
    });
  });
});

module.exports = router;
