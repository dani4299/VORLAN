// Persistent history for the admin charts: one row per minute, kept for 30 days (~43k rows).
// Queries re-bucket those minute rows into at most ~360 points per range so a 30-day chart is
// the same size as a 1-hour chart.

const RETENTION_DAYS = 30;

// `bucket` is spliced into SQL below, so it only ever comes from this constant map, never from a request.
const RANGES = {
  '1h': { seconds: 3600, bucket: 60 },
  '6h': { seconds: 6 * 3600, bucket: 60 },
  '24h': { seconds: 24 * 3600, bucket: 300 },
  '7d': { seconds: 7 * 86400, bucket: 1800 },
  '30d': { seconds: 30 * 86400, bucket: 7200 },
};

module.exports = (db) => {
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

  const init = () => run(`
    CREATE TABLE IF NOT EXISTS metrics_1m (
      ts INTEGER PRIMARY KEY,
      cpu_avg REAL, cpu_max REAL,
      mem_used REAL, mem_total REAL,
      net_rx REAL, net_tx REAL,
      disk_read REAL, disk_write REAL
    )
  `);

  const insertMinute = (r) => run(
    `INSERT OR REPLACE INTO metrics_1m
       (ts, cpu_avg, cpu_max, mem_used, mem_total, net_rx, net_tx, disk_read, disk_write)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.ts, r.cpu_avg, r.cpu_max, r.mem_used, r.mem_total, r.net_rx, r.net_tx, r.disk_read, r.disk_write]
  );

  /** AVG() ignores NULLs, so a metric this platform can't report (e.g. disk I/O on Windows) comes back null, not 0. */
  const queryRange = async (range, nowSec) => {
    const cfg = RANGES[range];
    if (!cfg) throw new Error(`Unknown range "${range}".`);
    const from = nowSec - cfg.seconds;
    const rows = await all(
      `SELECT (ts / ${cfg.bucket}) * ${cfg.bucket} AS t,
              AVG(cpu_avg) AS cpu, MAX(cpu_max) AS cpuMax,
              AVG(mem_used) AS memUsed, MAX(mem_total) AS memTotal,
              AVG(net_rx) AS netRx, AVG(net_tx) AS netTx,
              AVG(disk_read) AS diskRead, AVG(disk_write) AS diskWrite
         FROM metrics_1m
        WHERE ts >= ?
        GROUP BY t
        ORDER BY t`,
      [from]
    );
    return { range, bucketSeconds: cfg.bucket, from, to: nowSec, points: rows };
  };

  const prune = (nowSec) => run('DELETE FROM metrics_1m WHERE ts < ?', [nowSec - RETENTION_DAYS * 86400]);

  const summary = async () => {
    const [row] = await all('SELECT COUNT(*) AS rows, MIN(ts) AS oldest, MAX(ts) AS newest FROM metrics_1m');
    return { rows: row.rows, oldest: row.oldest, newest: row.newest };
  };

  return { init, insertMinute, queryRange, prune, summary };
};

module.exports.RANGES = RANGES;
module.exports.RETENTION_DAYS = RETENTION_DAYS;
