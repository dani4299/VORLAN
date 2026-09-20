const express = require('express');
const fs = require('fs');
const path = require('path');
const { GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR } = require('../config/paths');
const { verifyTokenOrFileCookie, requireVault } = require('../middleware/auth.middleware');
const { isSafeFileName } = require('../utils/safeName');

const router = express.Router();

// Photos, songs and documents load straight into the page (<img>, <audio>, a link), which can't send an
// Authorization header, so these accept the sign-in's file cookie instead. They used to be a plain
// public folder: anyone who could reach the address could read every file, private vault included.

const send = (res, directory, name) => {
  if (!isSafeFileName(name)) return res.status(400).json({ error: 'That isn\'t a valid file name.' });
  const full = path.join(directory, name);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return res.status(404).json({ error: 'That file no longer exists.' });
  // sendFile honours Range requests, so audio and video can be scrubbed.
  return res.sendFile(full, { dotfiles: 'allow', headers: { 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=0' } }, (err) => {
    if (err && !res.headersSent) res.status(err.status || 500).end();
  });
};

// A personal file is named `username_file`; the vault must be unlocked and the file must be yours.
router.get('/personal/:file', verifyTokenOrFileCookie, requireVault, (req, res) => {
  if (!req.params.file.startsWith(`${req.user.username}_`)) return res.status(403).json({ error: 'That file belongs to someone else.' });
  return send(res, PERSONAL_VAULT_DIR, req.params.file);
});

router.get('/:file', verifyTokenOrFileCookie, (req, res) => send(res, GLOBAL_MEDIA_DIR, req.params.file));

module.exports = router;
