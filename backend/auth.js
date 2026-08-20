const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // The VIP pass generator
const db = require('./db');

const router = express.Router();

// ==========================================
// 1. SIGNUP ROUTE (Onboarding to VORLAN)
// ==========================================
router.post('/signup', async (req, res) => {
  const { username, password, role } = req.body;

  // Basic validation check
  if (!username || !password) {
    return res.status(400).json({ error: 'Bro, you need to provide a username and password.' });
  }

  try {
    // Salt and hash the password (The '10' is the cost factor - standard for good security)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Assign the role. If they didn't pass one, default to 'guest'
    const userRole = role || 'guest';

    // Prepare the SQL query (No backslashes before the quotes this time!)
    const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
    
    // Execute the query
    db.run(query, [username, hashedPassword, userRole], function(err) {
      if (err) {
        // Handle the case where someone tries to register an existing username
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Username already taken, Buddyboy. Try another.' });
        }
        console.error("Database error:", err);
        return res.status(500).json({ error: 'Internal system error. We are cooked.' });
      }
      
      // Success!
      res.status(201).json({ 
        message: 'User registered successfully. Welcome to VORLAN.',
        userId: this.lastID,
        role: userRole
      });
    });
  } catch (error) {
    console.error("Hashing error:", error);
    res.status(500).json({ error: 'Encryption protocol failed.' });
  }
});

// ==========================================
// 2. LOGIN ROUTE (The Vault Gatekeeper)
// ==========================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Provide the creds, bro.' });
  }

  // Find the user in the database
  const query = 'SELECT * FROM users WHERE username = ?';
  
  db.get(query, [username], async (err, user) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: 'Vault database error.' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Ghost user. That username does not exist in the matrix.' });
    }

    // Check if the provided password matches the hashed one in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Nice try, hacker.' });
    }

    // Generate the JWT (The VIP Pass)
    // We put their ID, username, and role inside the token payload
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      'VORLAN_SUPER_SECRET_KEY', // In a real production app, this goes in a .env file
      { expiresIn: '24h' }
    );

    // Send the token back to the frontend
    res.json({
      message: 'Login successful. Access granted.',
      token: token,
      role: user.role
    });
  });
});

module.exports = router;