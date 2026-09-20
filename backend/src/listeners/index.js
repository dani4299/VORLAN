const deviceActivity = require('./deviceActivity.listener');
const taskAudit = require('./taskAudit.listener');
const requestStats = require('./requestStats.listener');
const auditRecord = require('./auditRecord.listener');

/** Every event subscriber is wired here, once, at startup. */
const register = () => {
  auditRecord.register();
  deviceActivity.register();
  taskAudit.register();
  requestStats.register();
};

module.exports = { register };
