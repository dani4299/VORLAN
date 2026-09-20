const express = require('express');
const { verifyToken, requireVault } = require('../middleware/auth.middleware');
const storage = require('../services/storage.service');

const router = express.Router();

// The personal summary is the signed-in person's own, and needs the vault unlocked; the shared one is open to anyone signed in.
const vaultIfPersonal = (req, res, next) => (req.query.scope === 'personal' ? requireVault(req, res, next) : next());

router.get('/summary', verifyToken, vaultIfPersonal, async (req, res) => {
  try {
    const summary = await storage.getSummary({ scope: req.query.scope, username: req.user.username });
    res.json(summary);
  } catch (err) {
    console.error('Storage summary error:', err);
    res.status(500).json({ error: 'Failed to read storage usage.' });
  }
});

module.exports = router;
