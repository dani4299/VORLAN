/**
 * Counts failures per key and blocks the key once it has had too many inside a window. In memory on
 * purpose: it slows down guessing, and a restart clearing it is not a way in that matters.
 * blocked(key) -> seconds still to wait (0 when free); fail(key) -> records one; succeed(key) -> forgets.
 */
const createLimiter = ({ max, windowMs }) => {
  const entries = new Map(); // key -> { count, since }

  const current = (key) => {
    const entry = entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.since >= windowMs) { entries.delete(key); return null; }
    return entry;
  };

  const sweep = () => {
    for (const key of entries.keys()) current(key);
  };
  setInterval(sweep, Math.max(windowMs, 60000)).unref();

  return {
    blocked(key) {
      const entry = current(key);
      if (!entry || entry.count < max) return 0;
      return Math.max(1, Math.ceil((entry.since + windowMs - Date.now()) / 1000));
    },
    /** Records a failure and says whether this one is the one that tripped the limit. */
    fail(key) {
      const entry = current(key) || { count: 0, since: Date.now() };
      entry.count += 1;
      entries.set(key, entry);
      return entry.count === max;
    },
    succeed(key) {
      entries.delete(key);
    },
  };
};

const intFromEnv = (name, fallback) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Wrong passwords: per address-and-name pair, so one person's typos never lock out someone else, and
// per address overall, so cycling through names from one machine doesn't help either.
const loginByAccount = createLimiter({ max: intFromEnv('VORLAN_LOGIN_MAX_FAILURES', 8), windowMs: 10 * 60 * 1000 });
const loginByAddress = createLimiter({ max: intFromEnv('VORLAN_LOGIN_ADDRESS_MAX_FAILURES', 40), windowMs: 10 * 60 * 1000 });
// A vault PIN is only six digits, so it is limited per account no matter where the guesses come from.
const vaultPin = createLimiter({ max: intFromEnv('VORLAN_PIN_MAX_FAILURES', 5), windowMs: 15 * 60 * 1000 });

module.exports = { createLimiter, loginByAccount, loginByAddress, vaultPin };
