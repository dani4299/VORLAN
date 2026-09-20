const db = require('../db');
const eventBus = require('./eventBus.service');

/** Writes one entry. The audit.record listener calls this; nothing else should need to. */
const record = (actorUsername, action, detail = null) => {
  db.run(
    'INSERT INTO audit_log (actor_username, action, detail, created_at) VALUES (?, ?, ?, ?)',
    [actorUsername || null, action, detail, new Date().toISOString()],
    (err) => {
      if (err) console.error('Failed to write audit log entry:', err.message);
    }
  );
};

/**
 * Reports something worth keeping a record of (a sign-in, a revoked session). It is published on the
 * event bus and written by the audit listener, so what happened stays separate from how it is stored.
 * Fire-and-forget by design - a logging failure should never break the action being logged. Where no
 * listener is registered (a script using the services on their own) it is written directly instead.
 */
const log = (actorUsername, action, detail = null) => {
  if (eventBus.hasListeners('audit.record')) eventBus.emit('audit.record', { actor: actorUsername, action, detail });
  else record(actorUsername, action, detail);
};

// An action is named `category.what_happened`, so a category filter is a prefix match.
const CATEGORIES = ['auth', 'account', 'admin', 'task'];

const escapeLike = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Newest first. `beforeId` pages backwards (pass the last id you have); one extra row is fetched
 * so the caller knows whether there is more without a second count query.
 */
const list = ({ limit = 100, category, search, beforeId } = {}) => new Promise((resolve, reject) => {
  const where = [];
  const params = [];
  if (CATEGORIES.includes(category)) { where.push("action LIKE ? ESCAPE '\\'"); params.push(`${category}.%`); }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push("(actor_username LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR detail LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  if (Number.isInteger(beforeId)) { where.push('id < ?'); params.push(beforeId); }

  const sql = `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
  db.all(sql, [...params, limit + 1], (err, rows) => {
    if (err) return reject(err);
    resolve({
      hasMore: rows.length > limit,
      entries: rows.slice(0, limit).map((r) => ({
        id: r.id,
        actor: r.actor_username,
        action: r.action,
        detail: r.detail,
        timestamp: r.created_at,
      })),
    });
  });
});

module.exports = { log, record, list, CATEGORIES };
