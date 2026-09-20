const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const history = require('../services/history.service');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({ sessions: await history.getSessions(req.user.id) });
  } catch (err) {
    console.error('Failed to load history:', err);
    res.status(500).json({ error: 'Failed to load history.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    await history.setSessions(req.user.id, req.body.sessions);
    res.json({ message: 'History synced.' });
  } catch (err) {
    console.error('Failed to save history:', err);
    res.status(500).json({ error: 'Failed to save history.' });
  }
});

module.exports = router;
