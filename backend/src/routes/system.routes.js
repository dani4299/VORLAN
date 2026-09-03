const express = require('express');
const fs = require('fs');
const os = require('os');
const si = require('systeminformation');
const QRCode = require('qrcode');
const verifyToken = require('../middleware/auth.middleware');
const storage = require('../services/storage.service');
const { getLocalIp } = require('../utils/localIp');
const { PORT } = require('../config/constants');
const { FRONTEND_INDEX_HTML } = require('../config/paths');

const router = express.Router();

// The Vite dev server port phones are told to visit in dev mode, matching the existing manual
// "type the IP into the browser" process this QR code replaces. An installed copy (a production
// build present) serves the frontend from the backend's own port instead - see server.js.
const DEV_FRONTEND_PORT = 5173;

router.get('/connect-qr', verifyToken, async (req, res) => {
  try {
    const port = fs.existsSync(FRONTEND_INDEX_HTML) ? PORT : DEV_FRONTEND_PORT;
    const url = `http://${getLocalIp()}:${port}`;
    const qr = await QRCode.toDataURL(url);
    res.json({ url, qr });
  } catch (err) {
    console.error('Failed to generate connect QR code:', err);
    res.status(500).json({ error: "Couldn't generate the QR code. Please try again." });
  }
});

router.get('/stats', verifyToken, async (req, res) => {
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();

  let disk = null;
  try {
    disk = await storage.getDiskUsage();
  } catch (err) {
    console.warn("Couldn't read disk usage:", err.message);
  }

  let battery = null;
  try {
    const b = await si.battery();
    battery = { hasBattery: b.hasBattery, isCharging: b.isCharging, percent: b.percent };
  } catch (err) {
    console.warn("Couldn't read battery status:", err.message);
  }

  let cpu = null;
  try {
    const load = await si.currentLoad();
    cpu = { percent: Math.round(load.currentLoad) };
  } catch (err) {
    console.warn("Couldn't read CPU load:", err.message);
  }

  let network = null;
  try {
    const iface = await si.networkInterfaces('default');
    network = { connected: iface.operstate === 'up', ip: iface.ip4 || null, type: iface.type || null };
  } catch (err) {
    console.warn("Couldn't read network status:", err.message);
  }

  res.json({
    ram: { usedBytes: totalMemBytes - freeMemBytes, totalBytes: totalMemBytes },
    disk,
    battery,
    cpu,
    network,
    uptimeSeconds: os.uptime(),
  });
});

module.exports = router;
