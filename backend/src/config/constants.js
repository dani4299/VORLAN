// In a real production deployment this secret (and the port) should come
// from environment variables / a .env file rather than being checked in.
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'VORLAN_SUPER_SECRET_KEY';
const JWT_EXPIRY = '24h';

module.exports = { PORT, JWT_SECRET, JWT_EXPIRY };
