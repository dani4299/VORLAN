const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PERSONAL_VAULT_DIR } = require('../config/paths');
const { VAULT_UNLOCK_SECONDS } = require('../config/constants');
const { verifyToken, requireVault, VAULT_COOKIE } = require('../middleware/auth.middleware');
const auditLog = require('../services/auditLog.service');
const sessions = require('../services/sessions.service');
const vaultPins = require('../services/vaultPins.service');
const { vaultPin } = require('../services/rateLimiter.service');
const { setCookie, clearCookie } = require('../utils/cookies');
const { isSafeFileName } = require('../utils/safeName');

const router = express.Router();

// Everything here is one signed-in person's own private space. Who they are comes from the sign-in,
// never from a name in the URL, a body or a header.
router.use(verifyToken);

const ownPrefix = (req) => `${req.user.username}_`;

/** The `:username` in a URL is only ever accepted when it is the person asking. */
const selfOnly = (req, res, next) => {
  if (req.params.username !== req.user.username) return res.status(403).json({ error: 'That private space belongs to someone else.' });
  return next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(PERSONAL_VAULT_DIR, { recursive: true });
    cb(null, PERSONAL_VAULT_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const prefix = ownPrefix(req);

    let finalName = `${prefix}${path.basename(file.originalname)}`;
    let counter = 1;
    while (fs.existsSync(path.join(PERSONAL_VAULT_DIR, finalName))) {
      finalName = `${prefix}${baseName}(${counter})${ext}`;
      counter++;
    }

    cb(null, finalName);
  },
});
const upload = multer({ storage });

router.get('/has-pin/:username', selfOnly, async (req, res) => {
  try {
    res.json({ hasPin: await vaultPins.hasPin(req.user.username) });
  } catch (err) {
    console.error('Failed to check vault PIN:', err);
    res.status(500).json({ error: 'Failed to check vault PIN.' });
  }
});

// Sets the PIN the first time, and unlocks the vault when it is right. Unlocking is what the server
// remembers (in a short-lived cookie): without it none of the routes below, and none of the vault's
// files, can be reached, whatever the page in front of it says.
router.post('/pin', async (req, res) => {
  const pin = req.body?.pin;
  if (!/^\d{6}$/.test(String(pin))) return res.status(400).json({ error: 'Enter your 6-digit PIN.' });

  const key = `pin|${req.user.id}`;
  const wait = vaultPin.blocked(key);
  if (wait) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: `Too many wrong PINs. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? 's' : ''}.`, code: 'rate_limited', retryAfter: wait });
  }

  try {
    const result = await vaultPins.verifyOrSet(req.user.username, String(pin));
    if (!result.success) {
      auditLog.log(req.user.username, 'auth.vault_pin_failed', 'wrong Personal Vault PIN');
      if (vaultPin.fail(key)) auditLog.log(req.user.username, 'auth.vault_blocked', 'too many wrong Personal Vault PINs');
      return res.status(401).json({ error: 'Incorrect PIN.' });
    }
    vaultPin.succeed(key);
    setCookie(req, res, VAULT_COOKIE, sessions.signVaultToken(req.user), VAULT_UNLOCK_SECONDS);
    return res.json({ success: true, unlockSeconds: VAULT_UNLOCK_SECONDS });
  } catch (err) {
    console.error('Failed to verify vault PIN:', err);
    return res.status(500).json({ error: 'Failed to verify vault PIN.' });
  }
});

router.post('/lock', (req, res) => {
  clearCookie(req, res, VAULT_COOKIE);
  res.json({ message: 'Locked.' });
});

// From here on the vault has to be unlocked.
router.use(requireVault);

router.post('/upload', upload.single('mediaFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file was attached to the upload.' });
  return res.json({ filename: req.file.filename });
});

router.get('/gallery/:username', selfOnly, (req, res) => {
  fs.readdir(PERSONAL_VAULT_DIR, (err, files) => {
    if (err) return res.json({ files: [] });
    return res.json({ files: files.filter((f) => f.startsWith(ownPrefix(req))) });
  });
});

router.delete('/delete/:filename', (req, res) => {
  const name = req.params.filename;
  if (!isSafeFileName(name)) return res.status(400).json({ error: 'That isn\'t a valid file name.' });
  if (!name.startsWith(ownPrefix(req))) return res.status(403).json({ error: 'That file belongs to someone else.' });

  const filePath = path.join(PERSONAL_VAULT_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'That file no longer exists.' });
  fs.unlinkSync(filePath);
  return res.json({ message: 'File deleted.' });
});

module.exports = router;
