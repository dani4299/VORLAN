const os = require('os');
const { execFileSync } = require('child_process');

/**
 * Interface names currently running as a WiFi access point (hotspot), per `iw dev` - covers a
 * hotspot brought up any way (VORLAN's own hotspot.service.js, the OS's built-in hotspot toggle,
 * a manual tool like create_ap), since `iw` reports the interface's mode regardless of who set it
 * up. Best-effort: returns an empty set if `iw` isn't available (non-Linux, no WiFi hardware).
 */
const getApInterfaces = () => {
  try {
    const output = execFileSync('iw', ['dev'], { encoding: 'utf8' });
    const apInterfaces = new Set();
    let current = null;
    for (const line of output.split('\n')) {
      const ifaceMatch = line.match(/^\s*Interface (\S+)/);
      if (ifaceMatch) { current = ifaceMatch[1]; continue; }
      if (/^\s*Unnamed\/non-netdev interface/.test(line)) { current = null; continue; }
      const typeMatch = line.match(/^\s*type (\S+)/);
      if (typeMatch && current && typeMatch[1] === 'AP') apInterfaces.add(current);
    }
    return apInterfaces;
  } catch {
    return new Set();
  }
};

/**
 * The PC's LAN-facing IPv4 address, e.g. "192.168.1.11" - falls back to "localhost" if none is
 * found. When a WiFi hotspot is active alongside the regular connection, the PC has multiple
 * non-internal IPv4 addresses at once (one per network); this prefers the hotspot's own address,
 * since a phone that joined via the hotspot has no route to the PC's other network and needs the
 * hotspot's gateway IP specifically to reach VORLAN.
 */
const getLocalIp = () => {
  const nets = os.networkInterfaces();
  const apInterfaces = getApInterfaces();
  let fallback = null;

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (apInterfaces.has(name)) return net.address;
      if (!fallback) fallback = net.address;
    }
  }
  return fallback || 'localhost';
};

module.exports = { getLocalIp };
