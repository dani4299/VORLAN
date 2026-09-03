const express = require('express');
const notes = require('../services/notes.service');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ notes: notes.list(req) });
});

router.post('/', (req, res) => {
  const { title, text } = req.body;
  if (!text && !title) return res.status(400).json({ error: 'Cannot save an empty note.' });
  res.json({ message: 'Note saved.', note: notes.create(req, { title, text }) });
});

router.put('/:id', (req, res) => {
  const updated = notes.update(req, parseInt(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: 'Note not found.' });
  res.json({ message: 'Note updated.', note: updated });
});

router.delete('/:id', (req, res) => {
  notes.remove(req, parseInt(req.params.id));
  res.json({ message: 'Note deleted.' });
});

module.exports = router;
