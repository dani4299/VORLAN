const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const authRoutes = require('./auth');
const multer = require('multer');

const app = express();
const PORT = 5000;

// Middleware so we can read JSON data and talk to our React frontend
app.use(cors());
// 🟢 FIXED: Uncapped the payload limit so massive Base64 PFP images can pass through the matrix
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mount the auth routes
app.use('/api/auth', authRoutes);


// Add this near the top with your other requires
const vaultRoutes = require('./vault');

// Add this below your app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);

// We also need to tell Express to actually SERVE the images so your React frontend can display them in the gallery.
// This makes the folder accessible, but we should honestly lock this down more later.
app.use('/media', express.static(path.join(__dirname, 'secure_vault', 'media')));

// Add this near the top
const aiRoutes = require('./ai');

// Add this below your other app.use statements
app.use('/api/ai', aiRoutes);

// ==========================================
// VORLAN NOTES MATRIX (Permanent Cloud & Multi-Tenant)
// ==========================================
const notesFile = path.join(__dirname, 'secure_vault', 'notes_matrix.json');

// 🟢 The Matrix Memory Bank
let allNotes = { global: [], personal: {} };
if (fs.existsSync(notesFile)) {
  allNotes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
}
const saveNotes = () => fs.writeFileSync(notesFile, JSON.stringify(allNotes));

// 🟢 The Router: Decides if data goes to the Global pool or a User's Private pool
const getNotesTarget = (req) => {
  const isPersonal = req.headers['x-personal'] === 'true';
  const user = req.headers['x-username'] || 'Ghost';
  if (isPersonal) {
    if (!allNotes.personal[user]) allNotes.personal[user] = [];
    return { array: allNotes.personal[user], isPersonal, user };
  }
  return { array: allNotes.global, isPersonal: false };
};

app.get('/api/notes', (req, res) => {
  res.json({ notes: getNotesTarget(req).array });
});

app.post('/api/notes', (req, res) => {
  const { title, text } = req.body;
  if (!text && !title) return res.status(400).json({ error: "Cannot save empty data." });
  
  const newNote = { id: Date.now(), title: title || '', text: text || '', timestamp: new Date().toISOString() };
  const target = getNotesTarget(req);
  
  target.array.unshift(newNote);
  saveNotes(); // 🟢 Burn to hard drive instantly
  res.json({ message: "Note secured in matrix.", note: newNote });
});

app.put('/api/notes/:id', (req, res) => {
  const { title, text } = req.body;
  const target = getNotesTarget(req);
  const noteIndex = target.array.findIndex(n => n.id === parseInt(req.params.id));
  
  if (noteIndex > -1) {
    if (title !== undefined) target.array[noteIndex].title = title;
    if (text !== undefined) target.array[noteIndex].text = text;
    saveNotes();
    res.json({ message: "Note updated", note: target.array[noteIndex] });
  } else {
    res.status(404).json({ error: "Note not found" });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  const target = getNotesTarget(req);
  target.array = target.array.filter(n => n.id !== parseInt(req.params.id));
  
  if (target.isPersonal) {
    allNotes.personal[target.user] = target.array;
  } else {
    allNotes.global = target.array;
  }
  saveNotes();
  res.json({ message: "Note deleted" });
});
// ==========================================
// VORLAN AI HISTORY MATRIX (Network Sync)
// ==========================================
let globalAiHistory = [
  { 
    id: Date.now(), 
    title: 'New Conversation', 
    messages: [{ role: 'system', content: 'Hello. I am the VORLAN AI assistant. How can I help you today?' }] 
  }
];

// Send the history to any device that asks
app.get('/api/history', (req, res) => {
  res.json({ sessions: globalAiHistory });
});

// Overwrite the global history whenever a device makes a change
app.post('/api/history', (req, res) => {
  globalAiHistory = req.body.sessions;
  res.json({ message: 'Matrix history synced across the network.' });
});


// ==========================================
// VORLAN CLOUD PROFILES (Permanent Disk Sync)
// ==========================================
const profilesFile = path.join(__dirname, 'profiles.json');

// 🟢 Load memory from disk on startup so it survives reboots!
let globalProfiles = {};
if (fs.existsSync(profilesFile)) {
  globalProfiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
}

// Fetch the profile picture for a specific user
app.get('/api/profile/:username', (req, res) => {
  res.json({ pfp: globalProfiles[req.params.username] || null });
});

// Save the profile picture to the global matrix
app.post('/api/profile/:username', (req, res) => {
  globalProfiles[req.params.username] = req.body.pfp;
  // 🟢 Permanently burn the data to the hard drive
  fs.writeFileSync(profilesFile, JSON.stringify(globalProfiles));
  res.json({ message: 'Profile permanently synced to disk matrix.' });
});


// ==========================================
// VORLAN PERSONAL VAULT (Multi-Tenant Matrix)
// ==========================================

// Create the isolated physical directory
const personalVaultDir = path.join(__dirname, 'secure_vault', 'personal');
if (!fs.existsSync(personalVaultDir)) {
  fs.mkdirSync(personalVaultDir, { recursive: true });
}

// Memory bank for 6-Digit PINs (Now permanently saved to disk!)
const pinsFile = path.join(personalVaultDir, 'vault_pins.json');
let vaultPins = {}; 
if (fs.existsSync(pinsFile)) {
  vaultPins = JSON.parse(fs.readFileSync(pinsFile, 'utf8'));
}

// The Courier for Personal Files (Windows-Style Auto-Renamer)
const personalStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, personalVaultDir),
  filename: (req, file, cb) => {
    const user = req.headers['x-username'] || 'Ghost';
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    
    // Start with the default: Username_OriginalName.ext
    let finalName = `${user}_${file.originalname}`;
    let counter = 1;
    
    // Windows Logic: If it exists, slap a (1), (2), (3) on it until it's unique
    while (fs.existsSync(path.join(personalVaultDir, finalName))) {
      finalName = `${user}_${baseName}(${counter})${ext}`;
      counter++;
    }
    
    cb(null, finalName);
  }
});
const uploadPersonal = multer({ storage: personalStorage });

// Serve the personal media
app.use('/media/personal', express.static(personalVaultDir));

// 🟢 1. Check if user already has a PIN
app.get('/api/personal/has-pin/:username', (req, res) => {
  res.json({ hasPin: !!vaultPins[req.params.username] });
});

// 🟢 2. Verify or Set PIN
app.post('/api/personal/pin', (req, res) => {
  const { username, pin } = req.body;
  
  // If no PIN exists for this user, create it!
  if (!vaultPins[username]) {
    vaultPins[username] = pin;
    fs.writeFileSync(pinsFile, JSON.stringify(vaultPins)); // 🟢 Burn it to disk
    return res.json({ success: true, message: 'Passcode locked in.' });
  }
  
  // If it exists, verify it!
  if (vaultPins[username] === pin) {
    return res.json({ success: true, message: 'Access Granted.' });
  }
  
  res.status(401).json({ error: 'ACCESS DENIED.' });
});

// 🟢 3. Upload specifically to Personal Vault
app.post('/api/personal/upload', uploadPersonal.single('mediaFile'), (req, res) => {
  res.json({ filename: req.file.filename });
});

// 🟢 4. Fetch ONLY the user's personal files
app.get('/api/personal/gallery/:username', (req, res) => {
  const user = req.params.username;
  fs.readdir(personalVaultDir, (err, files) => {
    if (err) return res.json({ files: [] });
    // Filter to only show files starting with "Username_"
    const userFiles = files.filter(f => f.startsWith(`${user}_`));
    res.json({ files: userFiles });
  });
});

// 🟢 5. Delete Personal File
app.delete('/api/personal/delete/:filename', (req, res) => {
  const filePath = path.join(personalVaultDir, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ message: 'Asset permanently purged from personal vault.' });
});

// --- IGNITION ---
// Listen on '0.0.0.0' so any device on the hotspot can connect
app.listen(PORT, '0.0.0.0', () => {
  // Find the laptop's network IP
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
      }
    }
  }

  console.log('===================================================');
  console.log(`🚀 VORLAN Edge Server Online`);
  console.log(`🔒 Port: ${PORT}`);
  console.log(`🌐 CONNECT YOUR PHONE TO: http://${localIp}:${PORT}`);
  console.log(`🧠 AI Node: Offline-First LLM linked (Port 11434)`);
  console.log(`📁 Vault: Secure Storage Mounted`);
  console.log('===================================================');
});