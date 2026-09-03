const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const storage = require('../services/storage.service');

const router = express.Router();

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const summary = await storage.getSummary({ scope: req.query.scope, username: req.query.username });
    res.json(summary);
  } catch (err) {
    console.error('Storage summary error:', err);
    res.status(500).json({ error: 'Failed to read storage usage.' });
  }
});

module.exports = router;
