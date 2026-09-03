const express = require('express');
const profiles = require('../services/profiles.service');

const router = express.Router();

router.get('/:username', (req, res) => {
  res.json(profiles.get(req.params.username));
});

router.post('/:username', (req, res) => {
  profiles.update(req.params.username, req.body);
  res.json({ message: 'Profile saved.' });
});

module.exports = router;
