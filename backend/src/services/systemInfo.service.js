const os = require('os');
const fs = require('fs');
const si = require('systeminformation');
const { DB_FILE } = require('../config/paths');
const pkg = require('../../package.json');

const INFO_TTL_MS = 5000;

const safe = async (fn) => {
  try { return await fn(); } catch { return null; }
};

const round1 = (n) => Math.round(n * 10) / 10;

// OS and CPU model never change while the process runs, and on Windows fetching them takes seconds,
// so they're read once. A failed read isn't cached - the next call tries again.
let staticInfo = null;
const loadStatic = async () => {
  if (staticInfo) return staticInfo;
  const [osInfo, cpu] = await Promise.all([safe(() => si.osInfo()), safe(() => si.cpu())]);
  if (osInfo && cpu) staticInfo = { osInfo, cpu };
  return { osInfo, cpu };
};

/** The AI engine is a separate local process, so "is it up and which models does it have" is a real health signal. */
const checkOllama = async () => {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { up: false, models: [] };
    const data = await res.json();
    return { up: true, models: (data.models || []).map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
};

const dbSizeBytes = () => {
  try { return fs.statSync(DB_FILE).size; } catch { return null; }
};

let cached = null; // { at, value }

const buildInfo = async () => {
  const [{ osInfo, cpu }, fsSize, ifaces, temp, ollama] = await Promise.all([
    loadStatic(),
    safe(() => si.fsSize()),
    safe(() => si.networkInterfaces()),
    safe(() => si.cpuTemperature()),
    checkOllama(),
  ]);
  const total = os.totalmem();

  return {
    host: {
      hostname: osInfo?.hostname || os.hostname(),
      platform: osInfo?.platform || os.platform(),
      distro: osInfo?.distro || null,
      release: osInfo?.release || os.release(),
      arch: osInfo?.arch || os.arch(),
      kernel: osInfo?.kernel || null,
      uptimeSeconds: os.uptime(),
      nodeVersion: process.version,
      vorlanVersion: pkg.version,
    },
    cpu: {
      // Brand strings often already start with the vendor ("Intel(R) Core(TM) ..."); don't say it twice.
      model: cpu ? (cpu.brand.toLowerCase().includes(cpu.manufacturer.toLowerCase()) ? cpu.brand : `${cpu.manufacturer} ${cpu.brand}`).trim() : null,
      cores: cpu?.cores ?? os.cpus().length,
      physicalCores: cpu?.physicalCores ?? null,
      speedGhz: cpu?.speed ?? null,
      temperatureC: typeof temp?.main === 'number' ? temp.main : null,
    },
    memory: { totalBytes: total, usedBytes: total - os.freemem() },
    disks: (fsSize || []).map((d) => ({
      name: d.fs, mount: d.mount, type: d.type,
      sizeBytes: d.size, usedBytes: d.used, availableBytes: d.available,
    })),
    network: (ifaces || [])
      .filter((n) => !n.internal)
      .map((n) => ({ name: n.iface, ip4: n.ip4 || null, mac: n.mac || null, speedMbps: n.speed ?? null, up: n.operstate === 'up', type: n.type || null })),
    services: [
      { id: 'api', name: 'VORLAN API', status: 'running', detail: `Up ${Math.floor(process.uptime())}s, Node ${process.version}` },
      { id: 'database', name: 'Database', status: dbSizeBytes() === null ? 'stopped' : 'running', detail: dbSizeBytes() === null ? 'Database file not found' : `${dbSizeBytes()} bytes on disk` },
      { id: 'ai', name: 'AI engine (Ollama)', status: ollama.up ? 'running' : 'stopped', detail: ollama.up ? (ollama.models.length ? ollama.models.join(', ') : 'No models installed') : 'Not reachable on port 11434' },
    ],
  };
};

/** Cached for a few seconds so several admin windows polling at once cost one round of system calls. */
const getInfo = async () => {
  if (cached && Date.now() - cached.at < INFO_TTL_MS) return cached.value;
  const value = await buildInfo();
  cached = { at: Date.now(), value };
  return value;
};

/** Busiest processes by CPU. The idle pseudo-process is dropped: it isn't work, it's the absence of it. */
const getProcesses = async (limit = 10) => {
  const data = await si.processes();
  const list = data.list
    .filter((p) => p.pid !== 0 && p.name !== 'System Idle Process')
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, limit)
    .map((p) => ({ pid: p.pid, name: p.name, user: p.user || null, cpu: round1(p.cpu), memBytes: p.memRss * 1024 }));
  return { total: data.all, list };
};

module.exports = { getInfo, getProcesses, checkOllama };
