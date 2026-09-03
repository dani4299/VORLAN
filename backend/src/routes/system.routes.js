const express = require('express');
const os = require('os');
const si = require('systeminformation');
const verifyToken = require('../middleware/auth.middleware');
const storage = require('../services/storage.service');

const router = express.Router();

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
