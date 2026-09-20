const eventBus = require('../services/eventBus.service');
const auditLog = require('../services/auditLog.service');

/** A failed background task shows up in the admin Activity Log, not just in the requester's error toast. */
const register = () => {
  eventBus.on('job.failed', (job) => {
    auditLog.log(job.startedBy, 'task.failed', `${job.label}: ${job.error}`);
  });
};

module.exports = { register };
