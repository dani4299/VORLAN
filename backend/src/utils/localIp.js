const os = require('os');

/** The PC's LAN-facing IPv4 address, e.g. "192.168.1.11" - falls back to "localhost" if none is found (no active network adapter). */
const getLocalIp = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

module.exports = { getLocalIp };
