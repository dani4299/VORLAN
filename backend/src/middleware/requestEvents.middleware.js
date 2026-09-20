const eventBus = require('../services/eventBus.service');

/**
 * Publishes one `request.completed` event per finished API request. It fires on response finish
 * because that's when the byte count is known, and it carries whoever verifyToken identified
 * (nobody, for a rejected or unauthenticated request) - what that's worth recording is up to the
 * listeners, not the auth layer.
 */
module.exports = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    eventBus.emit('request.completed', {
      status: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      userId: req.user?.id ?? null,
      deviceId: req.headers['x-device-id'] || null,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      bytes: parseInt(res.get('content-length'), 10) || 0,
    });
  });
  next();
};
