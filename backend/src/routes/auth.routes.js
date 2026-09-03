const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const verifyToken = require('../middleware/auth.middleware');
const account = require('../services/account.service');
const { JWT_SECRET, JWT_EXPIRY } = require('../config/constants');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, password, email, fullName, role } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Please enter a username, email, and password.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'guest';

    db.run(
      'INSERT INTO users (username, password, role, email, full_name) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, userRole, email, fullName || null],
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
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

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

    db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, req.user.id], (renameErr) => {
      if (renameErr) {
        if (renameErr.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'That username is already taken.' });
        }
        console.error('Failed to rename username:', renameErr);
        return res.status(500).json({ error: 'Failed to update username.' });
      }

      try {
        account.renameUsernameEverywhere(oldUsername, newUsername);
      } catch (cascadeErr) {
        console.error('Username rename cascade error:', cascadeErr);
      }

      applyFullName();
    });
  });
});

module.exports = router;
