const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PERSONAL_VAULT_DIR } = require('../config/paths');
const vaultPins = require('../services/vaultPins.service');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PERSONAL_VAULT_DIR),
  filename: (req, file, cb) => {
    const user = req.headers['x-username'] || 'Ghost';
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);

    let finalName = `${user}_${file.originalname}`;
    let counter = 1;
    while (fs.existsSync(path.join(PERSONAL_VAULT_DIR, finalName))) {
      finalName = `${user}_${baseName}(${counter})${ext}`;
      counter++;
    }

    cb(null, finalName);
  },
});
const upload = multer({ storage });

router.get('/has-pin/:username', async (req, res) => {
  try {
    res.json({ hasPin: await vaultPins.hasPin(req.params.username) });
  } catch (err) {
    console.error('Failed to check vault PIN:', err);
    res.status(500).json({ error: 'Failed to check vault PIN.' });
  }
});

router.post('/pin', async (req, res) => {
  const { username, pin } = req.body;
  try {
    const result = await vaultPins.verifyOrSet(username, pin);
    if (result.success) {
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Incorrect PIN.' });
  } catch (err) {
    console.error('Failed to verify vault PIN:', err);
    res.status(500).json({ error: 'Failed to verify vault PIN.' });
  }
});

router.post('/upload', upload.single('mediaFile'), (req, res) => {
  res.json({ filename: req.file.filename });
});

router.get('/gallery/:username', (req, res) => {
  const user = req.params.username;
  fs.readdir(PERSONAL_VAULT_DIR, (err, files) => {
    if (err) return res.json({ files: [] });
    res.json({ files: files.filter(f => f.startsWith(`${user}_`)) });
  });
});

router.delete('/delete/:filename', (req, res) => {
  const filePath = path.join(PERSONAL_VAULT_DIR, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ message: 'File deleted.' });
});

module.exports = router;
