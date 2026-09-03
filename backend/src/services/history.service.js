const fs = require('fs');
const { HISTORY_FILE } = require('../config/paths');

let allHistory = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : {};

const defaultSessions = () => [
  {
    id: Date.now(),
    title: 'New Conversation',
    messages: [{ role: 'system', content: "Hi, I'm your VORLAN assistant. How can I help you today?" }],
  },
];

const getSessions = (username) => allHistory[username] || defaultSessions();

const setSessions = (username, sessions) => {
  allHistory[username] = sessions;
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(allHistory));
};

module.exports = { getSessions, setSessions };
