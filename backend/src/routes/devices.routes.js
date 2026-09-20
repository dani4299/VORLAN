const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const devices = require('../services/devices.service');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({ devices: await devices.list(req.user.id) });
  } catch (err) {
    console.error('Failed to load devices:', err);
    res.status(500).json({ error: 'Failed to load devices.' });
  }
});

router.patch('/:id', verifyToken, async (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Please enter a device name.' });
  }

  try {
    const ok = await devices.rename(req.user.id, req.params.id, label.trim());
    if (!ok) return res.status(404).json({ error: 'Device not found.' });
    res.json({ message: 'Device renamed.' });
  } catch (err) {
    console.error('Failed to rename device:', err);
    res.status(500).json({ error: 'Failed to rename device.' });
  }
});

module.exports = router;
