const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please sign in.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(400).json({ error: 'Your session has expired. Please sign in again.' });
  }
};
