// backend/vault.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const verifyToken = require('./auth.middleware'); // Bring in the bouncer

const router = express.Router();

// Define where the vault lives
const vaultDir = path.join(__dirname, 'secure_vault', 'media');

// Big brain check: If the folder doesn't exist, make it.
if (!fs.existsSync(vaultDir)) {
  fs.mkdirSync(vaultDir, { recursive: true });
  console.log('Vault directory created. 🛡️');
}

// Set up Multer (The File Courier)
// Set up Multer (The File Courier - Global Edition)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vaultDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    
    // Start with the raw original name
    let finalName = file.originalname;
    let counter = 1;
    
    // Windows Logic: If it exists, slap a (1), (2), (3) on it
    while (fs.existsSync(path.join(vaultDir, finalName))) {
      finalName = `${baseName}(${counter})${ext}`;
      counter++;
    }
    
    cb(null, finalName);
  }
});

const upload = multer({ storage });

// --- UPLOAD ROUTE ---
// Notice how verifyToken sits right in the middle? That protects the route.
router.post('/upload', verifyToken, upload.single('mediaFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file detected, Buddyboy. Attach something.' });
  }
  
  res.status(201).json({ 
    message: 'File locked in the Vault.', 
    filename: req.file.filename 
  });
});

// --- GALLERY ROUTE ---
// Read the folder and return all file names
router.get('/gallery', verifyToken, (req, res) => {
  fs.readdir(vaultDir, (err, files) => {
    if (err) {
      console.error("Vault read error:", err);
      return res.status(500).json({ error: 'Failed to access the Vault archives.' });
    }
    
    // Send back an array of the filenames
    res.json({ files });
  });
});

// --- ACTUAL DELETE ROUTE ---
router.delete('/delete/:filename', verifyToken, (req, res) => {
  const filePath = path.join(vaultDir, req.params.filename);
  const fs = require('fs'); // Just in case it's not imported
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath); // 🟢 This actually deletes the file from your hard drive
    res.json({ message: 'Asset permanently purged.' });
  } else {
    res.status(404).json({ error: 'Asset already ghosted.' });
  }
});

module.exports = router;