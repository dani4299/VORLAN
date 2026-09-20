const db = require('../db');
const { describeUserAgent } = require('../utils/userAgent');

/** Records one request against a user's device, creating the device record the first time it's seen. */
const touch = (userId, deviceId, { userAgent, ip, bytes }) => new Promise((resolve, reject) => {
  db.get('SELECT * FROM devices WHERE user_id = ? AND device_id = ?', [userId, deviceId], (err, existing) => {
    if (err) return reject(err);

    const now = Date.now();
    const label = existing?.custom_label ? existing.label : describeUserAgent(userAgent);
    const customLabel = existing?.custom_label ? 1 : 0;
    const finalUserAgent = userAgent || existing?.user_agent || null;
    const finalIp = ip || existing?.ip || null;
    const firstSeen = existing?.first_seen || now;
    const totalBytes = (existing?.bytes || 0) + (bytes || 0);

    db.run(
      `INSERT INTO devices (user_id, device_id, label, custom_label, user_agent, ip, first_seen, last_seen, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, device_id) DO UPDATE SET
         label = excluded.label, custom_label = excluded.custom_label, user_agent = excluded.user_agent,
         ip = excluded.ip, last_seen = excluded.last_seen, bytes = excluded.bytes`,
      [userId, deviceId, label, customLabel, finalUserAgent, finalIp, firstSeen, now, totalBytes],
      (insertErr) => (insertErr ? reject(insertErr) : resolve())
    );
  });
});

const list = (userId) => new Promise((resolve, reject) => {
  db.all('SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen DESC', [userId], (err, rows) => {
    if (err) return reject(err);
    resolve(rows.map((r) => ({
      id: r.device_id,
      label: r.label,
      customLabel: !!r.custom_label,
      userAgent: r.user_agent,
      ip: r.ip,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      bytes: r.bytes,
    })));
  });
});

/** Resolves false if the device doesn't exist for this user (e.g. renaming someone else's device id). */
const rename = (userId, deviceId, label) => new Promise((resolve, reject) => {
  db.run(
    'UPDATE devices SET label = ?, custom_label = 1 WHERE user_id = ? AND device_id = ?',
    [label, userId, deviceId],
    function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    }
  );
});

/** Admin view across every user's devices, not just the caller's own. */
const listAll = () => new Promise((resolve, reject) => {
  db.all(
    `SELECT d.*, u.username FROM devices d
     JOIN users u ON u.id = d.user_id
     ORDER BY d.last_seen DESC`,
    (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => ({
        id: r.device_id,
        userId: r.user_id,
        username: r.username,
        label: r.label,
        customLabel: !!r.custom_label,
        userAgent: r.user_agent,
        ip: r.ip,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        bytes: r.bytes,
      })));
    }
  );
});

/** Admin-initiated device removal. This clears the device's activity record — since VORLAN's
 * JWTs are still stateless with no revocation list yet, it does not force that device to sign
 * out; a still-logged-in device simply reappears here on its next request. */
const remove = (userId, deviceId) => new Promise((resolve, reject) => {
  db.run('DELETE FROM devices WHERE user_id = ? AND device_id = ?', [userId, deviceId], function (err) {
    if (err) return reject(err);
    resolve(this.changes > 0);
  });
});

module.exports = { touch, list, rename, listAll, remove };
