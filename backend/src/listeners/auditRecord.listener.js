const eventBus = require('../services/eventBus.service');
const auditLog = require('../services/auditLog.service');

/** Anything reported as an "audit.record" event ends up in the admin Log Center. */
const register = () => {
  eventBus.on('audit.record', ({ actor, action, detail }) => auditLog.record(actor, action, detail));
};

module.exports = { register };
