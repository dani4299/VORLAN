const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const history = require('../services/history.service');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  res.json({ sessions: history.getSessions(req.user.username) });
});

router.post('/', verifyToken, (req, res) => {
  history.setSessions(req.user.username, req.body.sessions);
  res.json({ message: 'History synced.' });
});

module.exports = router;
