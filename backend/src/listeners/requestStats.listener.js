const eventBus = require('../services/eventBus.service');
const requestStats = require('../services/requestStats.service');

/** Keeps the API's request counters (Services window) up to date. */
const register = () => {
  eventBus.on('request.completed', (event) => requestStats.record(event));
};

module.exports = { register };
