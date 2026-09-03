const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const devices = require('../services/devices.service');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  res.json({ devices: devices.list(req.user.username) });
});

router.patch('/:id', verifyToken, (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Please enter a device name.' });
  }

  const ok = devices.rename(req.user.username, req.params.id, label.trim());
  if (!ok) return res.status(404).json({ error: 'Device not found.' });

  res.json({ message: 'Device renamed.' });
});

module.exports = router;
