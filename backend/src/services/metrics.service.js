const os = require('os');
const si = require('systeminformation');
const db = require('../db');
const createStore = require('./metrics.store');

const store = createStore(db);

const INTERVAL_MS = Number(process.env.VORLAN_METRICS_INTERVAL_MS) || 5000;
const LIVE_KEPT = Math.ceil((60 * 60 * 1000) / INTERVAL_MS); // one hour of live samples

// The live view is served from memory (last hour); everything older comes from the database
// rollups. A restart empties the live buffer and loses at most the minute in progress.
const live = [];
let minuteBucket = null; // { minute, samples: [] }
let prevCpu = null;
let timer = null;
let sampling = false;

const cpuTimes = () => os.cpus().reduce((acc, c) => {
  acc.idle += c.times.idle;
  acc.total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  return acc;
}, { idle: 0, total: 0 });

/** CPU busy % since the previous call, from Node's own counters - no child process, so it's free to call often. */
const cpuPercent = () => {
  const now = cpuTimes();
  const prev = prevCpu;
  prevCpu = now;
  if (!prev) return null;
  const total = now.total - prev.total;
  if (total <= 0) return null;
  return Math.round((1 - (now.idle - prev.idle) / total) * 1000) / 10;
};

const safe = async (fn) => {
  try { return await fn(); } catch { return null; }
};

const numberOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One reading. Anything the platform can't report stays null instead of pretending to be 0. */
const sampleOnce = async () => {
  const totalMem = os.totalmem();
  const sample = {
    t: Math.floor(Date.now() / 1000),
    cpu: cpuPercent(),
    memUsed: totalMem - os.freemem(),
    memTotal: totalMem,
    netRx: null,
    netTx: null,
    diskRead: null,
    diskWrite: null,
  };

  const net = await safe(() => si.networkStats());
  if (Array.isArray(net) && net[0]) {
    sample.netRx = numberOrNull(net[0].rx_sec);
    sample.netTx = numberOrNull(net[0].tx_sec);
  }
  const fsStats = await safe(() => si.fsStats());
  if (fsStats) {
    sample.diskRead = numberOrNull(fsStats.rx_sec);
    sample.diskWrite = numberOrNull(fsStats.wx_sec);
  }
  return sample;
};

const average = (values) => {
  const nums = values.filter((v) => typeof v === 'number');
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};
const maximum = (values) => {
  const nums = values.filter((v) => typeof v === 'number');
  return nums.length ? Math.max(...nums) : null;
};

/** Collapses one minute of samples into the single row stored for that minute. */
const rollup = (minute, samples) => ({
  ts: minute,
  cpu_avg: average(samples.map((s) => s.cpu)),
  cpu_max: maximum(samples.map((s) => s.cpu)),
  mem_used: average(samples.map((s) => s.memUsed)),
  mem_total: maximum(samples.map((s) => s.memTotal)),
  net_rx: average(samples.map((s) => s.netRx)),
  net_tx: average(samples.map((s) => s.netTx)),
  disk_read: average(samples.map((s) => s.diskRead)),
  disk_write: average(samples.map((s) => s.diskWrite)),
});

const flush = (bucket) => {
  store.insertMinute(rollup(bucket.minute, bucket.samples)).catch((err) => console.error('Failed to save metrics:', err.message));
  if (bucket.minute % 3600 === 0) {
    store.prune(bucket.minute).catch((err) => console.error('Failed to prune metrics:', err.message));
  }
};

/** Files a sample into the live buffer and the current minute; a finished minute is rolled up and saved. */
const ingest = (sample) => {
  live.push(sample);
  if (live.length > LIVE_KEPT) live.shift();

  const minute = Math.floor(sample.t / 60) * 60;
  if (minuteBucket && minuteBucket.minute !== minute) {
    flush(minuteBucket);
    minuteBucket = null;
  }
  if (!minuteBucket) minuteBucket = { minute, samples: [] };
  minuteBucket.samples.push(sample);
};

const tick = async () => {
  if (sampling) return; // a slow sample (PowerShell on Windows can take seconds) must never stack up
  sampling = true;
  try {
    ingest(await sampleOnce());
  } catch (err) {
    console.error('Metrics sample failed:', err.message);
  } finally {
    sampling = false;
  }
};

const start = async () => {
  await store.init();
  tick();
  timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
};

const stop = () => { clearInterval(timer); timer = null; };

const getLive = (seconds = 900) => {
  const since = Math.floor(Date.now() / 1000) - seconds;
  return { intervalSeconds: INTERVAL_MS / 1000, points: live.filter((s) => s.t >= since) };
};

const getHistory = (range) => store.queryRange(range, Math.floor(Date.now() / 1000));

/** Health of the sampler itself, for the Services window. */
const getStatus = async () => ({
  running: timer !== null,
  intervalSeconds: INTERVAL_MS / 1000,
  liveSamples: live.length,
  lastSampleAt: live.length ? live[live.length - 1].t : null,
  retentionDays: createStore.RETENTION_DAYS,
  saved: await store.summary(),
});

module.exports = { start, stop, getLive, getHistory, getStatus, ingest, rollup, RANGES: createStore.RANGES };
