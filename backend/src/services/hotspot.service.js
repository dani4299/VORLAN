const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const { ROOT_DIR } = require('../config/paths');

const execFileAsync = util.promisify(execFile);

const CONNECTION_NAME = 'VORLAN-Hotspot';
const CONFIG_FILE = path.join(ROOT_DIR, 'hotspot_config.json');
const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const generatePassword = (length = 12) =>
  Array.from({ length }, () => PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)]).join('');

/** Loads the persisted hotspot SSID/password, generating and saving them the first time this runs. */
const loadOrCreateConfig = () => {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  const config = {
    ssid: `VORLAN-${os.hostname()}`.slice(0, 32),
    password: generatePassword(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
};

/** Finds the first WiFi-capable network device NetworkManager knows about. */
const getWifiDevice = async () => {
  const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'DEVICE,TYPE', 'device']);
  const line = stdout.split('\n').find((l) => l.endsWith(':wifi'));
  if (!line) throw new Error('No WiFi adapter found on this system.');
  return line.split(':')[0];
};

const connectionExists = async () => {
  const { stdout } = await execFileAsync('nmcli', ['-g', 'NAME', 'connection', 'show']);
  return stdout.split('\n').includes(CONNECTION_NAME);
};

const connectionIsActive = async () => {
  const { stdout } = await execFileAsync('nmcli', ['-g', 'NAME', 'connection', 'show', '--active']);
  return stdout.split('\n').includes(CONNECTION_NAME);
};

const createConnection = async (device, ssid, password) => {
  await execFileAsync('nmcli', [
    'connection', 'add',
    'type', 'wifi',
    'ifname', device,
    'con-name', CONNECTION_NAME,
    'autoconnect', 'no',
    'ssid', ssid,
    '802-11-wireless.mode', 'ap',
    '802-11-wireless.band', 'bg',
    'ipv4.method', 'shared',
    'wifi-sec.key-mgmt', 'wpa-psk',
    'wifi-sec.psk', password,
  ]);
};

const activateConnection = async () => {
  await execFileAsync('nmcli', ['connection', 'up', CONNECTION_NAME]);
};

/** The device NetworkManager actually bound the connection to once active - may be a virtual AP interface distinct from the physical WiFi device name. */
const getBoundDevice = async () => {
  const { stdout } = await execFileAsync('nmcli', ['-g', 'GENERAL.DEVICES', 'connection', 'show', CONNECTION_NAME]);
  const device = stdout.trim();
  if (!device) throw new Error('VORLAN-Hotspot connection has no bound device yet.');
  return device;
};

const getGatewayIp = async (device) => {
  const { stdout } = await execFileAsync('nmcli', ['-g', 'IP4.ADDRESS', 'device', 'show', device]);
  const address = stdout.trim().split('\n')[0]; // e.g. "10.42.0.1/24"
  if (!address) throw new Error("Could not determine the hotspot's IP address.");
  return address.split('/')[0];
};

let ensureInFlight = null;

/** Idempotent: creates the VORLAN-Hotspot connection if missing, activates it if inactive, returns its details. Concurrent calls share one in-flight attempt instead of racing separate nmcli invocations. */
const ensureHotspot = () => {
  if (!ensureInFlight) {
    ensureInFlight = (async () => {
      const { ssid, password } = loadOrCreateConfig();

      if (!(await connectionExists())) {
        const device = await getWifiDevice();
        await createConnection(device, ssid, password);
      }
      if (!(await connectionIsActive())) {
        await activateConnection();
      }

      const boundDevice = await getBoundDevice();
      const gatewayIp = await getGatewayIp(boundDevice);

      return { ssid, password, gatewayIp };
    })().finally(() => {
      ensureInFlight = null;
    });
  }
  return ensureInFlight;
};

module.exports = { ensureHotspot };
