const fs = require('fs');
const { DEVICES_FILE } = require('../config/paths');
const { describeUserAgent } = require('../utils/userAgent');

let allDevices = fs.existsSync(DEVICES_FILE) ? JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8')) : {};

const save = () => fs.writeFileSync(DEVICES_FILE, JSON.stringify(allDevices));

/** Records one request against a user's device, creating the device record the first time it's seen. */
const touch = (username, deviceId, { userAgent, ip, bytes }) => {
  const userDevices = allDevices[username] || (allDevices[username] = {});
  const existing = userDevices[deviceId];
  const now = Date.now();

  userDevices[deviceId] = {
    label: existing?.customLabel ? existing.label : describeUserAgent(userAgent),
    customLabel: existing?.customLabel || false,
    userAgent: userAgent || existing?.userAgent || null,
    ip: ip || existing?.ip || null,
    firstSeen: existing?.firstSeen || now,
    lastSeen: now,
    bytes: (existing?.bytes || 0) + (bytes || 0),
  };
  save();
};

const list = (username) => {
  const userDevices = allDevices[username] || {};
  return Object.entries(userDevices)
    .map(([id, device]) => ({ id, ...device }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
};

/** Returns false if the device doesn't exist for this user (e.g. renaming someone else's device id). */
const rename = (username, deviceId, label) => {
  const device = allDevices[username]?.[deviceId];
  if (!device) return false;
  device.label = label;
  device.customLabel = true;
  save();
  return true;
};

module.exports = { touch, list, rename };
