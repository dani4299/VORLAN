const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middleware/auth.middleware');
const { GLOBAL_MEDIA_DIR } = require('../config/paths');

const router = express.Router();

if (!fs.existsSync(GLOBAL_MEDIA_DIR)) {
  fs.mkdirSync(GLOBAL_MEDIA_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GLOBAL_MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);

    let finalName = file.originalname;
    let counter = 1;
    while (fs.existsSync(path.join(GLOBAL_MEDIA_DIR, finalName))) {
      finalName = `${baseName}(${counter})${ext}`;
      counter++;
    }

    cb(null, finalName);
  },
});

const upload = multer({ storage });

router.post('/upload', verifyToken, upload.single('mediaFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was attached to the upload.' });
  }
  res.status(201).json({ message: 'File uploaded.', filename: req.file.filename });
});

router.get('/gallery', verifyToken, (req, res) => {
  fs.readdir(GLOBAL_MEDIA_DIR, (err, files) => {
    if (err) {
      console.error('Vault read error:', err);
      return res.status(500).json({ error: 'Failed to read shared files.' });
    }
    res.json({ files });
  });
});

router.delete('/delete/:filename', verifyToken, (req, res) => {
  const filePath = path.join(GLOBAL_MEDIA_DIR, req.params.filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted.' });
  } else {
    res.status(404).json({ error: 'That file no longer exists.' });
  }
});

module.exports = router;
