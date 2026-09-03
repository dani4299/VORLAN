const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/auth.middleware');

const router = express.Router();

const SYSTEM_PREAMBLE = 'You are the VORLAN system AI, an offline-first smart home and network management assistant created by DSRF Softech Studios. Keep answers short, clear, and helpful.';

router.post('/ask', verifyToken, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Please enter a message.' });
  }

  try {
    // Ollama streams newline-delimited JSON chunks ({"response":"tok","done":false}) - we forward
    // just the token text as it arrives so the client can render it token-by-token as it's generated,
    // rather than waiting for the whole reply and faking the animation afterward.
    const ollamaResponse = await axios.post(
      'http://localhost:11434/api/generate',
      { model: 'phi3', prompt: `${SYSTEM_PREAMBLE} User says: ${prompt}`, stream: true },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    let buffer = '';
    ollamaResponse.data.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop(); // last entry may be a partial line - keep it for the next chunk
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) res.write(parsed.response);
        } catch {
          // an incomplete/malformed line - skip it rather than crash the stream
        }
      }
    });
    ollamaResponse.data.on('end', () => res.end());
    ollamaResponse.data.on('error', (err) => {
      console.error('Ollama stream error:', err.message);
      res.end();
    });
  } catch (error) {
    console.error('AI node error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'The assistant is currently offline. Make sure Ollama is running.' });
    } else {
      res.end();
    }
  }
});

router.post('/title', verifyToken, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Please provide the conversation to summarize.' });
  }

  const transcript = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

  try {
    const ollamaResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi3',
      prompt: `Summarize the topic of this conversation in 2 to 4 words, title case, no punctuation, no quotes. Reply with only the title.\n\n${transcript}\n\nTitle:`,
      stream: false,
    });
    const title = ollamaResponse.data.response.trim().replace(/^["']|["']$/g, '').split('\n')[0].slice(0, 40);
    res.json({ title: title || 'New Conversation' });
  } catch (error) {
    console.error('AI title error:', error.message);
    res.status(500).json({ error: 'Could not generate a title.' });
  }
});

module.exports = router;
