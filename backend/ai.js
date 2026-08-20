// backend/ai.js
const express = require('express');
const axios = require('axios');
const verifyToken = require('./auth.middleware'); // Keep the AI locked behind the VORLAN auth wall

const router = express.Router();

// --- THE AI CHAT ROUTE ---
router.post('/ask', verifyToken, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Bro, you gotta say something." });
  }

  try {
    // We hit the local Ollama instance running in the background. Zero internet required.
    const ollamaResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi3',
      // We inject a system prompt so it acts like the VORLAN system
      prompt: `You are the VORLAN system AI, an offline-first smart home and network management assistant created by DSRF Softech Studios. Keep answers short, technical, and helpful. User says: ${prompt}`,
      stream: false // We want the whole response at once, not chunked
    });

    // Send the AI's reply back to React
    res.json({ reply: ollamaResponse.data.response });
    
  } catch (error) {
    console.error("AI Node Error:", error.message);
    res.status(500).json({ error: "Edge AI offline. Check if Ollama is running, Buddyboy." });
  }
});

module.exports = router;