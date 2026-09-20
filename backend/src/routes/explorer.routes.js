const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middleware/auth.middleware');
const explorer = require('../services/explorer.service');
const jobQueue = require('../services/jobQueue.service');

const router = express.Router();

/** Only errors the service layer raised on purpose carry a status and a message written for users. Anything else is a raw system error (ENOENT, EISDIR, ...) whose message includes absolute server file paths, so it's logged and replaced with a generic one. */
const sendError = (res, err) => {
  console.error('Explorer error:', err.message);
  if (err.status) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

/** Wraps a handler so a thrown { status, message } from the service layer becomes the right HTTP response. */
const handle = (fn) => (req, res) => {
  try {
    fn(req, res);
  } catch (err) {
    sendError(res, err);
  }
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        cb(null, explorer.safeResolve(req.query.path || ''));
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const dir = explorer.safeResolve(req.query.path || '');
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      let finalName = file.originalname;
      let counter = 1;
      while (fs.existsSync(path.join(dir, finalName))) {
        finalName = `${base} (${counter})${ext}`;
        counter++;
      }
      cb(null, finalName);
    },
  }),
});

router.get('/list', verifyToken, handle((req, res) => {
  res.json({ path: req.query.path || '', entries: explorer.listDir(req.query.path || '') });
}));

router.get('/recent', verifyToken, handle((req, res) => {
  res.json({ files: explorer.recentFiles(20) });
}));

router.get('/search', verifyToken, handle((req, res) => {
  const q = (req.query.q || '').trim();
  res.json({ results: q ? explorer.search(q) : [] });
}));

router.get('/download', verifyToken, handle((req, res) => {
  const full = explorer.safeResolve(req.query.path || '');
  res.download(full);
}));

router.post('/folder', verifyToken, handle((req, res) => {
  const { path: relPath, name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Please enter a folder name.' });
  explorer.createFolder(relPath || '', name.trim());
  res.status(201).json({ message: 'Folder created.' });
}));

router.post('/upload', verifyToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(err.status || 500).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file was attached to the upload.' });
    res.status(201).json({ message: 'File uploaded.', filename: req.file.filename });
  });
});

router.delete('/item', verifyToken, handle((req, res) => {
  explorer.deleteEntry(req.query.path || '');
  res.json({ message: 'Deleted.' });
}));

router.patch('/item', verifyToken, handle((req, res) => {
  const { path: relPath, newName } = req.body;
  if (!newName || !newName.trim()) return res.status(400).json({ error: 'Please enter a name.' });
  explorer.renameEntry(relPath, newName.trim());
  res.json({ message: 'Renamed.' });
}));

// The copy runs on the job queue so it can't freeze the server, but the response still waits for
// it to finish - the file manager refreshes the folder as soon as this returns.
router.post('/copy', verifyToken, async (req, res) => {
  const { from, to } = req.body;
  try {
    const plan = explorer.planCopy(from, to || '');
    const job = jobQueue.enqueue('explorer.copy', () => explorer.executeCopy(plan), {
      label: `Copy ${from} to ${to || 'Files'}`,
      startedBy: req.user.username,
    });
    await job.done;
    res.json({ message: 'Copied.' });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/move', verifyToken, handle((req, res) => {
  const { from, to } = req.body;
  explorer.moveEntry(from, to || '');
  res.json({ message: 'Moved.' });
}));

module.exports = router;
