const express = require('express');
const notes = require('../services/notes.service');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json({ notes: await notes.list(req) });
  } catch (err) {
    console.error('Failed to load notes:', err);
    res.status(500).json({ error: 'Failed to load notes.' });
  }
});

router.post('/', async (req, res) => {
  const { title, text } = req.body;
  if (!text && !title) return res.status(400).json({ error: 'Cannot save an empty note.' });
  try {
    res.json({ message: 'Note saved.', note: await notes.create(req, { title, text }) });
  } catch (err) {
    console.error('Failed to save note:', err);
    res.status(500).json({ error: 'Failed to save note.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await notes.update(req, parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Note not found.' });
    res.json({ message: 'Note updated.', note: updated });
  } catch (err) {
    console.error('Failed to update note:', err);
    res.status(500).json({ error: 'Failed to update note.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await notes.remove(req, parseInt(req.params.id));
    res.json({ message: 'Note deleted.' });
  } catch (err) {
    console.error('Failed to delete note:', err);
    res.status(500).json({ error: 'Failed to delete note.' });
  }
});

module.exports = router;
