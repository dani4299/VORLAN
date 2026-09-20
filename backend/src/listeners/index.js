const deviceActivity = require('./deviceActivity.listener');
const taskAudit = require('./taskAudit.listener');
const requestStats = require('./requestStats.listener');

/** Every event subscriber is wired here, once, at startup. */
const register = () => {
  deviceActivity.register();
  taskAudit.register();
  requestStats.register();
};

module.exports = { register };
