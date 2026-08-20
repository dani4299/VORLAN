// backend/auth.middleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Grab the token from the header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Format is usually "Bearer [TOKEN]"

  if (!token) {
    return res.status(401).json({ error: 'Access Denied. Who even are you, bro?' });
  }

  try {
    // Verify the token using our secret key
    const verified = jwt.verify(token, 'VORLAN_SUPER_SECRET_KEY'); // We'll move this to a .env file later for max security
    req.user = verified;
    next(); // Pass them through to the actual route!
  } catch (err) {
    res.status(400).json({ error: 'Fake or expired token. Nice try.' });
  }
};