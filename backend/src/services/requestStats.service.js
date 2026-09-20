// Running totals for the API since it started, fed by the `request.completed` event. In memory on
// purpose: these describe this process's health right now, not history worth keeping.
const startedAt = Date.now();
const stats = { total: 0, clientErrors: 0, serverErrors: 0, totalMs: 0, slowest: 0 };

const record = ({ status, durationMs }) => {
  stats.total += 1;
  if (status >= 500) stats.serverErrors += 1;
  else if (status >= 400) stats.clientErrors += 1;
  if (typeof durationMs === 'number') {
    stats.totalMs += durationMs;
    stats.slowest = Math.max(stats.slowest, durationMs);
  }
};

const snapshot = () => ({
  startedAt,
  total: stats.total,
  clientErrors: stats.clientErrors,
  serverErrors: stats.serverErrors,
  averageMs: stats.total ? stats.totalMs / stats.total : null,
  slowestMs: stats.total ? stats.slowest : null,
});

module.exports = { record, snapshot };
