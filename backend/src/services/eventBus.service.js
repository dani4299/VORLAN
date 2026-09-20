const { EventEmitter } = require('events');

const emitter = new EventEmitter();

/** A listener that throws or rejects is logged and swallowed, so a broken subscriber (analytics,
 * auditing) can never break the request or job that published the event. */
const on = (event, handler) => {
  const report = (err) => console.error(`Listener for "${event}" failed:`, err.message);
  emitter.on(event, (payload) => {
    try {
      const result = handler(payload);
      if (result && typeof result.catch === 'function') result.catch(report);
    } catch (err) {
      report(err);
    }
  });
};

const emit = (event, payload) => emitter.emit(event, payload);

module.exports = { on, emit };
