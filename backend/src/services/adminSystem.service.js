const os = require('os');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const si = require('systeminformation');
const db = require('../db');
const { PORT: CONFIGURED_PORT } = require('../config/constants');

const PORT = Number(CONFIGURED_PORT); // a string when it comes from the environment
const {
  ROOT_DIR, SECURE_VAULT_DIR, GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR, EXPLORER_DIR, DB_FILE, FRONTEND_INDEX_HTML,
} = require('../config/paths');
const pkg = require('../../package.json');
const systemInfo = require('./systemInfo.service');
const metrics = require('./metrics.service');
const jobQueue = require('./jobQueue.service');
const requestStats = require('./requestStats.service');
const auditLog = require('./auditLog.service');

const safe = async (fn) => {
  try { return await fn(); } catch { return null; }
};

const count = (sql) => new Promise((resolve) => {
  db.get(sql, (err, row) => resolve(err ? null : row.n));
});

const fileSize = (file) => {
  try { return fs.statSync(file).size; } catch { return null; }
};

// ---------------------------------------------------------------- storage

const MAX_ENTRIES_SCANNED = 200000;

/** Total size and file count under a folder. Stops (and says so) rather than freezing on a huge tree. */
const measureDir = async (dir, budget) => {
  let bytes = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (budget.left-- <= 0) { budget.truncated = true; return { bytes, files }; }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        const stat = await safe(() => fs.promises.stat(full));
        if (stat) { bytes += stat.size; files += 1; }
      }
    }
  }
  return { bytes, files };
};

/** Which volume the VORLAN data folder sits on: the mount whose path is the longest prefix of it. */
const hostVolume = (disks) => {
  const home = SECURE_VAULT_DIR.toLowerCase();
  let best = null;
  for (const d of disks) {
    const mount = (d.mount || '').toLowerCase();
    if (mount && home.startsWith(mount) && (!best || mount.length > best.mount.length)) best = { mount, original: d.mount };
  }
  return best?.original ?? null;
};

let storageCache = null; // { at, value }
let storagePending = null;
const STORAGE_TTL_MS = 30000;

const scanStorage = async () => {
  const budget = { left: MAX_ENTRIES_SCANNED, truncated: false };
  const locations = [];

  let explorerEntries = [];
  try { explorerEntries = await fs.promises.readdir(EXPLORER_DIR, { withFileTypes: true }); } catch { /* not created yet */ }
  let looseBytes = 0;
  let looseFiles = 0;
  for (const entry of explorerEntries) {
    if (entry.isDirectory()) {
      locations.push({ id: `files:${entry.name}`, group: 'Files', label: entry.name, ...(await measureDir(path.join(EXPLORER_DIR, entry.name), budget)) });
    } else if (entry.isFile()) {
      const stat = await safe(() => fs.promises.stat(path.join(EXPLORER_DIR, entry.name)));
      if (stat) { looseBytes += stat.size; looseFiles += 1; }
    }
  }
  if (looseFiles) locations.push({ id: 'files:loose', group: 'Files', label: 'Loose files', bytes: looseBytes, files: looseFiles });

  locations.push({ id: 'media', group: 'Shared media', label: 'Shared media', ...(await measureDir(GLOBAL_MEDIA_DIR, budget)) });
  locations.push({ id: 'personal', group: 'Personal vaults', label: 'Personal vaults', ...(await measureDir(PERSONAL_VAULT_DIR, budget)) });
  const dbBytes = fileSize(DB_FILE);
  if (dbBytes !== null) locations.push({ id: 'database', group: 'System', label: 'Database', bytes: dbBytes, files: 1 });

  return {
    locations,
    totalBytes: locations.reduce((sum, l) => sum + l.bytes, 0),
    totalFiles: locations.reduce((sum, l) => sum + l.files, 0),
    truncated: budget.truncated,
    scannedAt: Date.now(),
  };
};

/** Volumes are live; the folder scan is cached for 30 seconds, and concurrent callers share one scan. */
const getStorage = async () => {
  const info = await systemInfo.getInfo();
  if (!storageCache || Date.now() - storageCache.at > STORAGE_TTL_MS) {
    storagePending = storagePending || scanStorage().finally(() => { storagePending = null; });
    storageCache = { at: Date.now(), value: await storagePending };
  }
  return { volumes: info.disks, dataVolume: hostVolume(info.disks), ...storageCache.value };
};

// ---------------------------------------------------------------- services

const getServices = async () => {
  const [info, ollama, sampler, users, devices, notes, auditEntries] = await Promise.all([
    systemInfo.getInfo(),
    systemInfo.checkOllama(),
    metrics.getStatus(),
    count('SELECT COUNT(*) AS n FROM users'),
    count('SELECT COUNT(*) AS n FROM devices'),
    count('SELECT COUNT(*) AS n FROM notes'),
    count('SELECT COUNT(*) AS n FROM audit_log'),
  ]);
  const mem = process.memoryUsage();
  const req = requestStats.snapshot();
  const tasks = jobQueue.list();
  const tasksBy = (status) => tasks.filter((t) => t.status === status).length;
  const dbBytes = fileSize(DB_FILE);
  const samplerFresh = sampler.lastSampleAt !== null && Date.now() / 1000 - sampler.lastSampleAt < sampler.intervalSeconds * 6;

  return {
    services: [
      {
        id: 'api', name: 'VORLAN API', status: 'running', summary: `Listening on port ${PORT}`,
        details: [
          { label: 'Process ID', value: process.pid },
          { label: 'Port', value: PORT },
          { label: 'Started', value: new Date(req.startedAt).toISOString(), kind: 'time' },
          { label: 'Memory in use', value: mem.rss, kind: 'bytes' },
          { label: 'Requests handled', value: req.total, kind: 'number' },
          { label: 'Client errors (4xx)', value: req.clientErrors, kind: 'number' },
          { label: 'Server errors (5xx)', value: req.serverErrors, kind: 'number' },
          { label: 'Average response time', value: req.averageMs, kind: 'ms' },
          { label: 'Slowest response', value: req.slowestMs, kind: 'ms' },
        ],
      },
      {
        id: 'database', name: 'Database', status: dbBytes === null ? 'stopped' : 'running',
        summary: dbBytes === null ? 'Database file not found' : 'SQLite, file on local disk',
        details: [
          { label: 'File size', value: dbBytes, kind: 'bytes' },
          { label: 'Accounts', value: users, kind: 'number' },
          { label: 'Devices recorded', value: devices, kind: 'number' },
          { label: 'Notes', value: notes, kind: 'number' },
          { label: 'Log entries', value: auditEntries, kind: 'number' },
        ],
      },
      {
        id: 'metrics', name: 'Metrics sampler', status: sampler.running && samplerFresh ? 'running' : 'stopped',
        summary: sampler.running ? `Samples every ${sampler.intervalSeconds} seconds` : 'Not running',
        details: [
          { label: 'Sample interval', value: `${sampler.intervalSeconds} seconds` },
          { label: 'Last sample', value: sampler.lastSampleAt ? new Date(sampler.lastSampleAt * 1000).toISOString() : null, kind: 'time' },
          { label: 'Live samples in memory', value: sampler.liveSamples, kind: 'number' },
          { label: 'Saved minutes', value: sampler.saved.rows, kind: 'number' },
          { label: 'Oldest saved reading', value: sampler.saved.oldest ? new Date(sampler.saved.oldest * 1000).toISOString() : null, kind: 'time' },
          { label: 'History kept for', value: `${sampler.retentionDays} days` },
        ],
      },
      {
        id: 'tasks', name: 'Task queue', status: 'running',
        summary: `${tasksBy('running')} running, ${tasksBy('queued')} waiting`,
        details: [
          { label: 'Running', value: tasksBy('running'), kind: 'number' },
          { label: 'Waiting', value: tasksBy('queued'), kind: 'number' },
          { label: 'Finished', value: tasksBy('succeeded'), kind: 'number' },
          { label: 'Failed', value: tasksBy('failed'), kind: 'number' },
        ],
      },
      {
        id: 'ai', name: 'AI engine (Ollama)', status: ollama.up ? 'running' : 'stopped',
        summary: ollama.up ? 'Reachable on port 11434' : 'Not reachable on port 11434',
        details: [
          { label: 'Address', value: 'http://localhost:11434' },
          { label: 'Installed models', value: ollama.models.length ? ollama.models.join(', ') : ollama.up ? 'None' : null },
        ],
      },
    ],
    checkedAt: Date.now(),
    host: info.host.hostname,
  };
};

// ---------------------------------------------------------------- network

let networkCache = null;
const NETWORK_TTL_MS = 2000;

const buildNetwork = async () => {
  const [ifaces, stats, gateway] = await Promise.all([
    safe(() => si.networkInterfaces()),
    safe(() => si.networkStats('*')),
    safe(() => si.networkGatewayDefault()),
  ]);
  const statsBy = new Map((Array.isArray(stats) ? stats : []).map((s) => [s.iface, s]));
  const defaultIface = safe(() => si.networkInterfaceDefault());

  const interfaces = (Array.isArray(ifaces) ? ifaces : [])
    .filter((n) => !n.internal)
    .map((n) => {
      const s = statsBy.get(n.iface);
      return {
        name: n.iface,
        label: n.ifaceName && n.ifaceName !== n.iface ? n.ifaceName : null,
        type: n.type || null,
        up: n.operstate === 'up',
        ip4: n.ip4 || null,
        ip6: n.ip6 || null,
        mac: n.mac || null,
        speedMbps: typeof n.speed === 'number' && n.speed > 0 ? n.speed : null,
        dhcp: typeof n.dhcp === 'boolean' ? n.dhcp : null,
        rxPerSec: typeof s?.rx_sec === 'number' ? s.rx_sec : null,
        txPerSec: typeof s?.tx_sec === 'number' ? s.tx_sec : null,
        rxBytes: typeof s?.rx_bytes === 'number' ? s.rx_bytes : null,
        txBytes: typeof s?.tx_bytes === 'number' ? s.tx_bytes : null,
      };
    });

  return {
    hostname: os.hostname(),
    defaultInterface: await defaultIface,
    gateway: gateway || null,
    dnsServers: dns.getServers(),
    interfaces,
    // Where to open VORLAN from another device on the network.
    urls: interfaces.filter((n) => n.up && n.ip4).map((n) => ({ interface: n.name, url: `http://${n.ip4}:${PORT}` })),
    port: PORT,
  };
};

const getNetwork = async () => {
  if (networkCache && Date.now() - networkCache.at < NETWORK_TTL_MS) return networkCache.value;
  const value = await buildNetwork();
  networkCache = { at: Date.now(), value };
  return value;
};

// ---------------------------------------------------------------- about + diagnostics

const getAbout = () => ({
  product: 'VORLAN',
  version: pkg.version,
  nodeVersion: process.version,
  platform: `${os.type()} ${os.release()} (${os.arch()})`,
  processId: process.pid,
  startedAt: new Date(requestStats.snapshot().startedAt).toISOString(),
  mode: fs.existsSync(FRONTEND_INDEX_HTML) ? 'Installed: serves the built web app' : 'Development: web app served separately',
  port: PORT,
  paths: { install: ROOT_DIR, database: DB_FILE, storage: SECURE_VAULT_DIR },
});

/** Everything support would ask for. Deliberately contains no passwords, PIN hashes or signing secrets. */
const getDiagnostics = async () => {
  const [info, services, network, storage, recent] = await Promise.all([
    systemInfo.getInfo(),
    getServices(),
    getNetwork(),
    getStorage(),
    auditLog.list({ limit: 200 }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    about: getAbout(),
    system: info,
    services: services.services,
    network,
    storage,
    tasks: jobQueue.list(),
    recentLog: recent.entries,
  };
};

module.exports = { getStorage, getServices, getNetwork, getAbout, getDiagnostics };
