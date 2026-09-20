const express = require('express');
const profiles = require('../services/profiles.service');

const router = express.Router();

router.get('/:username', async (req, res) => {
  try {
    res.json(await profiles.get(req.params.username));
  } catch (err) {
    console.error('Failed to load profile:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.post('/:username', async (req, res) => {
  try {
    await profiles.update(req.params.username, req.body);
    res.json({ message: 'Profile saved.' });
  } catch (err) {
    console.error('Failed to save profile:', err);
    res.status(500).json({ error: 'Failed to save profile.' });
  }
});

module.exports = router;
