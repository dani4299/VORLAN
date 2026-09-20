const intFromEnv = (name, fallback) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const MINUTE = 60;
const DAY = 24 * 60 * 60;

// Ports. Plain HTTP stays on PORT for this computer itself (http://localhost:5000 needs no
// certificate); everything reaching VORLAN from another device is sent to HTTPS_PORT.
const PORT = intFromEnv('PORT', 5000);
const HTTPS_PORT = intFromEnv('VORLAN_HTTPS_PORT', 5443);
const TLS_ENABLED = !['off', 'false', '0', 'no'].includes(String(process.env.VORLAN_TLS || 'on').toLowerCase());

// Sign-in. An access token is short: it is only ever a passing proof of a session that lives in the
// database, so a stolen one stops working within minutes, and signing out or revoking the session
// kills it at once. A refresh token trades for a new pair and is replaced every time it is used.
const ACCESS_TOKEN_TTL_SECONDS = intFromEnv('VORLAN_ACCESS_TTL_SECONDS', 15 * MINUTE);
const REFRESH_TTL_SECONDS = intFromEnv('VORLAN_REFRESH_TTL_SECONDS', 30 * DAY); // idle time before a session lapses
const SESSION_MAX_SECONDS = intFromEnv('VORLAN_SESSION_MAX_SECONDS', 90 * DAY); // however active, sign in again after this
// A refresh token that was just replaced may legitimately arrive once more (two tabs refreshing at the
// same moment); inside this window that is a race and is answered gently, after it it means theft.
const REFRESH_GRACE_SECONDS = intFromEnv('VORLAN_REFRESH_GRACE_SECONDS', 30);
const VAULT_UNLOCK_SECONDS = intFromEnv('VORLAN_VAULT_UNLOCK_SECONDS', 15 * MINUTE);

module.exports = {
  PORT, HTTPS_PORT, TLS_ENABLED,
  ACCESS_TOKEN_TTL_SECONDS, REFRESH_TTL_SECONDS, SESSION_MAX_SECONDS, REFRESH_GRACE_SECONDS, VAULT_UNLOCK_SECONDS,
};
