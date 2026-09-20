const eventBus = require('../services/eventBus.service');
const devices = require('../services/devices.service');

/** Records Connected Devices activity for authenticated requests. The frontend sends a
 * per-browser id (generated once, persisted in localStorage) as X-Device-Id. */
const register = () => {
  eventBus.on('request.completed', ({ userId, deviceId, userAgent, ip, bytes }) => {
    if (!userId || !deviceId) return undefined;
    return devices.touch(userId, deviceId, { userAgent, ip, bytes });
  });
};

module.exports = { register };
