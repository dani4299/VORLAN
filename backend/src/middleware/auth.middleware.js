const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config/constants');

const endSession = (res, error) => res.status(401).json({ error, code: 'session_ended' });

/**
 * Verifies the token, then checks the account it names still exists. The role comes from the
 * database, not the token, so deleting an account or changing its role takes effect on the very next
 * request instead of whenever the 24-hour token happens to expire.
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please sign in.' });
  }

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return endSession(res, 'Your session has expired. Please sign in again.');
  }

  db.get('SELECT id, username, role FROM users WHERE id = ?', [claims.id], (err, user) => {
    if (err) {
      console.error('Failed to verify account:', err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    if (!user) return endSession(res, 'This account no longer exists.');
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  });
};
