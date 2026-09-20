const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const profiles = require('../services/profiles.service');

const router = express.Router();

// A profile holds someone's picture, layout and appearance. Only they can read or change it; the
// name in the URL has to be theirs.
router.use(verifyToken);
router.use('/:username', (req, res, next) => {
  if (req.params.username !== req.user.username) return res.status(403).json({ error: 'That profile belongs to someone else.' });
  return next();
});

router.get('/:username', async (req, res) => {
  try {
    res.json(await profiles.get(req.user.username));
  } catch (err) {
    console.error('Failed to load profile:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.post('/:username', async (req, res) => {
  try {
    await profiles.update(req.user.username, req.body);
    res.json({ message: 'Profile saved.' });
  } catch (err) {
    console.error('Failed to save profile:', err);
    res.status(500).json({ error: 'Failed to save profile.' });
  }
});

module.exports = router;
