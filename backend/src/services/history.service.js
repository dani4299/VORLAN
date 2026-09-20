const db = require('../db');

const defaultSessions = () => [
  {
    id: Date.now(),
    title: 'New Conversation',
    messages: [{ role: 'system', content: "Hi, I'm your VORLAN assistant. How can I help you today?" }],
  },
];

const getSessions = (userId) => new Promise((resolve, reject) => {
  db.get('SELECT sessions FROM ai_history WHERE user_id = ?', [userId], (err, row) => {
    if (err) return reject(err);
    resolve(row ? JSON.parse(row.sessions) : defaultSessions());
  });
});

const setSessions = (userId, sessions) => new Promise((resolve, reject) => {
  db.run(
    `INSERT INTO ai_history (user_id, sessions) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET sessions = excluded.sessions`,
    [userId, JSON.stringify(sessions)],
    (err) => (err ? reject(err) : resolve())
  );
});

module.exports = { getSessions, setSessions };
