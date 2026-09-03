const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const devices = require('../services/devices.service');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please sign in.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);

    // Piggybacks on every authenticated request to record Connected Devices activity - the
    // frontend sends a per-browser id it generates once and persists in localStorage.
    const deviceId = req.headers['x-device-id'];
    if (deviceId) {
      res.on('finish', () => {
        devices.touch(req.user.username, deviceId, {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          bytes: parseInt(res.get('content-length'), 10) || 0,
        });
      });
    }

    next();
  } catch (err) {
    res.status(400).json({ error: 'Your session has expired. Please sign in again.' });
  }
};
