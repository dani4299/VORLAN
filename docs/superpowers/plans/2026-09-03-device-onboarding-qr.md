# Device Onboarding via QR Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Connect device" button to the VORLAN dashboard that brings up a PC-hosted WiFi hotspot and shows two QR codes — one to join it, one to open VORLAN — replacing the current manual "connect to hotspot, type the IP by hand" process.

**Architecture:** A Linux-only backend service (`hotspot.service.js`) drives NetworkManager via `nmcli` to create and activate a dedicated `VORLAN-Hotspot` connection profile, concurrently with the PC's existing WiFi (verified supported on this hardware). A single auth-protected route (`POST /api/hotspot/connect`) calls that service and returns two server-generated QR code images (WiFi-join payload, VORLAN URL payload). The frontend adds a button + two-step modal that calls the route and renders the QR codes.

**Tech Stack:** Node/Express backend (existing), `nmcli` (NetworkManager CLI, already installed), `qrcode` npm package (new dependency), React frontend (existing), no new frontend dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-device-onboarding-qr-design.md`

## Global Constraints

- Linux-only. No Windows implementation in this plan (spec explicitly defers it).
- No Electron/desktop-app work (spec explicitly defers it) — the QR's URL points at the existing Vite dev server port (5173), matching how the app is accessed manually today.
- Hotspot password: exactly 12 characters, alphanumeric only (`A-Za-z0-9`) — required so the `WIFI:` QR payload never needs escaping (see spec's "Config persistence" section).
- Hotspot SSID: `VORLAN-<hostname>`, truncated to 32 bytes.
- The hotspot connection profile is named exactly `VORLAN-Hotspot`.
- All `nmcli` invocations use `execFile` with an argument array (never `exec` with a shell string) — avoids shell-injection risk even though current inputs are self-generated.
- Config persists at `backend/hotspot_config.json`, gitignored, generated once and reused across restarts.
- This codebase has no backend test framework configured (`backend/package.json`'s `test` script is a stub). Per the spec's own testing plan, verification here is real: run the actual code against the actual `nmcli`/NetworkManager on this machine and inspect real output, rather than mocking. Every task's verification step is a real command against a real running process.

---

### Task 1: Hotspot service (NetworkManager via `nmcli`)

**Files:**
- Create: `backend/src/services/hotspot.service.js`
- Modify: `.gitignore` (repo root) — add `backend/hotspot_config.json` under the existing "Real user data - do not commit" section

**Interfaces:**
- Produces: `ensureHotspot(): Promise<{ ssid: string, password: string, gatewayIp: string }>` — the only export. Idempotent: safe to call repeatedly; concurrent calls share one in-flight attempt.

- [ ] **Step 1: Add the gitignore entry**

In `.gitignore`, under the existing `# Real user data - do not commit` section, add:

```
backend/hotspot_config.json
```

- [ ] **Step 2: Write `hotspot.service.js`**

```javascript
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
```

- [ ] **Step 3: Verify against the real system**

Run from the `backend/` directory:

```bash
node -e "require('./src/services/hotspot.service').ensureHotspot().then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); })"
```

Expected: prints `{"ssid":"VORLAN-<hostname>","password":"<12 chars>","gatewayIp":"<an IP>"}` with no error.

Then confirm both connections are active simultaneously and `backend/hotspot_config.json` was created:

```bash
nmcli -g NAME connection show --active
cat backend/hotspot_config.json
```

Expected: the active-connections list includes both `VORLAN-Hotspot` and your normal WiFi connection (not just one or the other) — this is the concurrent AP+STA behavior the spec relies on. The config file has `ssid` and `password` fields.

Run the same `node -e` command a second time. Expected: it resolves quickly (no new `nmcli connection add`/`up` — the connection already exists and is active) and returns the identical `ssid`/`password` as the first run (loaded from `hotspot_config.json`, not regenerated).

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/hotspot.service.js .gitignore
git commit -m "$(cat <<'EOF'
Add hotspot.service.js for NetworkManager-backed device onboarding

Creates and activates a dedicated VORLAN-Hotspot connection concurrently
with the PC's existing WiFi, using nmcli. Idempotent; config persists
across restarts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D6cnmvYLvaKHrn3jSfcuHa
EOF
)"
```

---

### Task 2: `POST /api/hotspot/connect` route

**Files:**
- Create: `backend/src/routes/hotspot.routes.js`
- Modify: `backend/server.js` — wire up the new route
- Modify: `backend/package.json` — add `qrcode` dependency

**Interfaces:**
- Consumes: `hotspot.service.js`'s `ensureHotspot(): Promise<{ ssid, password, gatewayIp }>` (Task 1).
- Produces: `POST /api/hotspot/connect` (auth-protected), response body `{ ssid, password, url, wifiQr, urlQr }` where `wifiQr`/`urlQr` are `data:image/png;base64,...` strings — this is what Task 3's frontend consumes.

- [ ] **Step 1: Add the `qrcode` dependency**

```bash
cd backend && npm install qrcode@^1.5.4
```

- [ ] **Step 2: Write `hotspot.routes.js`**

```javascript
const express = require('express');
const QRCode = require('qrcode');
const verifyToken = require('../middleware/auth.middleware');
const hotspot = require('../services/hotspot.service');

const router = express.Router();

// The Vite dev server port phones are already told to visit today - this route automates
// that existing manual process, not the (separately deferred) production packaging story.
const FRONTEND_PORT = 5173;

router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { ssid, password, gatewayIp } = await hotspot.ensureHotspot();
    const url = `http://${gatewayIp}:${FRONTEND_PORT}`;

    const wifiPayload = `WIFI:T:WPA;S:${ssid};P:${password};;`;
    const [wifiQr, urlQr] = await Promise.all([
      QRCode.toDataURL(wifiPayload),
      QRCode.toDataURL(url),
    ]);

    res.json({ ssid, password, url, wifiQr, urlQr });
  } catch (err) {
    console.error('Failed to bring up the VORLAN hotspot:', err);
    res.status(500).json({ error: err.message || "Couldn't start the hotspot. Please try again." });
  }
});

module.exports = router;
```

- [ ] **Step 3: Wire it into `server.js`**

In `backend/server.js`, alongside the existing route requires (near `const explorerRoutes = require('./src/routes/explorer.routes');`):

```javascript
const hotspotRoutes = require('./src/routes/hotspot.routes');
```

Alongside the existing `app.use('/api/explorer', explorerRoutes);`:

```javascript
app.use('/api/hotspot', hotspotRoutes);
```

- [ ] **Step 4: Verify against the real running backend**

Start the backend (`cd backend && node server.js`, or confirm it's already running), then from another terminal:

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
U="hotspot_verify_$(date +%s)"
P="Password123!"
curl -s -X POST http://localhost:5000/api/auth/signup -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\",\"email\":\"$U@example.com\"}" > /dev/null
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -X POST http://localhost:5000/api/hotspot/connect -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: JSON with `ssid`, `password` (12 chars), `url` (`http://<ip>:5173`), and `wifiQr`/`urlQr` both starting with `data:image/png;base64,`.

Also confirm the endpoint rejects unauthenticated requests:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/hotspot/connect
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/hotspot.routes.js backend/server.js backend/package.json backend/package-lock.json
git commit -m "$(cat <<'EOF'
Add POST /api/hotspot/connect route

Returns the hotspot's WiFi-join and VORLAN-URL QR codes as data URIs,
generated server-side via the qrcode package.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D6cnmvYLvaKHrn3jSfcuHa
EOF
)"
```

---

### Task 3: Frontend — button, modal, and dashboard wiring

**Files:**
- Create: `frontend/src/lib/hotspotApi.js`
- Create: `frontend/src/components/dashboard/ConnectDeviceButton.jsx`
- Create: `frontend/src/components/dashboard/ConnectDeviceModal.jsx`
- Modify: `frontend/src/pages/dashboard/HomePage.jsx`

**Interfaces:**
- Consumes: `POST /api/hotspot/connect` (Task 2), response shape `{ ssid, password, url, wifiQr, urlQr }`.
- Consumes existing: `IconButton` (`frontend/src/components/ui/Button.jsx`), `Modal` (`frontend/src/components/ui/Modal.jsx`), `Button` (`frontend/src/components/ui/Button.jsx`), `Spinner` (`frontend/src/components/ui/Spinner.jsx`), `authHeaders`/`api` (`frontend/src/lib/api.js`).
- Produces: `connectDevice(): Promise<{ ssid, password, url, wifiQr, urlQr }>` (thin API wrapper), `<ConnectDeviceButton onClick overlayTone>`, `<ConnectDeviceModal onClose>` — both consumed only by `HomePage.jsx` in this task.

- [ ] **Step 1: Write `hotspotApi.js`**

```javascript
import api, { authHeaders } from './api';

export const connectDevice = () =>
  api.post('/hotspot/connect', {}, { headers: authHeaders() }).then((r) => r.data);
```

- [ ] **Step 2: Write `ConnectDeviceButton.jsx`**

```jsx
import React from 'react';
import { QrCode } from 'lucide-react';
import { IconButton } from '../ui/Button';

export const ConnectDeviceButton = ({ onClick, overlayTone }) => (
  <IconButton onClick={onClick} overlay overlayTone={overlayTone} title="Connect a device">
    <QrCode size={18} />
  </IconButton>
);
```

- [ ] **Step 3: Write `ConnectDeviceModal.jsx`**

```jsx
import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { connectDevice } from '../../lib/hotspotApi';

export const ConnectDeviceModal = ({ onClose }) => {
  const [step, setStep] = useState('wifi'); // 'wifi' | 'url'
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    connectDevice()
      .then((res) => setData(res))
      .catch((err) => setError(err.response?.data?.error || "Couldn't connect. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Modal title={step === 'wifi' ? 'Join network' : 'Open VORLAN'} onClose={onClose}>
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <Spinner />
          <p className="text-sm text-[var(--ink-muted)]">Starting the hotspot…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-center" style={{ color: 'var(--hue-rose)' }}>{error}</p>
          <Button variant="secondary" size="md" onClick={load}>Try again</Button>
        </div>
      ) : step === 'wifi' ? (
        <div className="flex flex-col items-center gap-4">
          <img src={data.wifiQr} alt="WiFi join QR code" className="w-56 h-56 rounded-2xl" />
          <p className="text-sm text-[var(--ink-muted)] text-center">
            Scan to join <span className="font-semibold text-[var(--ink)]">{data.ssid}</span>
          </p>
          <Button variant="primary" size="md" className="w-full" onClick={() => setStep('url')}>Next</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <img src={data.urlQr} alt="VORLAN URL QR code" className="w-56 h-56 rounded-2xl" />
          <p className="text-sm text-[var(--ink-muted)] text-center break-all">
            Scan to open <span className="font-semibold text-[var(--ink)]">{data.url}</span>
          </p>
          <Button variant="primary" size="md" className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
};
```

- [ ] **Step 4: Wire into `HomePage.jsx`**

Add imports, alongside the existing `AccountSettingsModal` import:

```javascript
import { ConnectDeviceButton } from '../../components/dashboard/ConnectDeviceButton';
import { ConnectDeviceModal } from '../../components/dashboard/ConnectDeviceModal';
```

Add state, alongside the existing `accountOpen` state:

```javascript
const [connectOpen, setConnectOpen] = useState(false);
```

Change the bottom bar from `justify-start` (single button) to `justify-between` (two buttons, left and right), and add the new button:

```jsx
<div className="flex-shrink-0 flex justify-between">
  <IconButton
    onClick={() => setEditMode((o) => !o)}
    overlay={!editMode}
    overlayTone={textTone}
    style={editMode ? { background: 'var(--accent)', color: '#fff' } : undefined}
    title={editMode ? 'Done editing' : 'Edit tiles'}
  >
    {editMode ? <Check size={18} /> : <Pencil size={18} />}
  </IconButton>
  <ConnectDeviceButton onClick={() => setConnectOpen(true)} overlayTone={textTone} />
</div>
```

Render the modal, alongside the existing `{accountOpen && <AccountSettingsModal ... />}` line:

```jsx
{connectOpen && <ConnectDeviceModal onClose={() => setConnectOpen(false)} />}
```

- [ ] **Step 5: Verify the build compiles**

```bash
cd frontend && npm run build
```

Expected: builds with no errors (warnings about chunk size are pre-existing and fine).

- [ ] **Step 6: Verify the flow live with Playwright**

Playwright is already installed in the scratchpad's `pw-test` directory from earlier sessions. With both the backend (port 5000) and frontend dev server (port 5173) running, write and run a throwaway script (not committed) similar to this shape:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const username = 'qrflow_' + Date.now();

  await page.goto('http://localhost:5173/signup');
  await page.waitForTimeout(400);
  const inputs = await page.$$('input');
  await inputs[0].fill(username);
  await inputs[2].fill(`${username}@example.com`);
  await inputs[3].fill('Password123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(400);
  const li = await page.$$('input');
  await li[0].fill(username);
  await li[1].fill('Password123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  await page.click('[title="Connect a device"]');
  await page.waitForTimeout(1500); // hotspot may already be up from Task 1/2 verification, but allow time
  await page.screenshot({ path: 'connect-01-wifi-step.png' });

  const wifiImgSrc = await page.getAttribute('img[alt="WiFi join QR code"]', 'src');
  console.log('WIFI QR present:', !!wifiImgSrc && wifiImgSrc.startsWith('data:image/png'));

  await page.click('text=Next');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'connect-02-url-step.png' });

  const urlImgSrc = await page.getAttribute('img[alt="VORLAN URL QR code"]', 'src');
  console.log('URL QR present:', !!urlImgSrc && urlImgSrc.startsWith('data:image/png'));

  await page.click('text=Done');
  await page.waitForTimeout(300);
  const modalGone = await page.$('text=Join network');
  console.log('Modal closed after Done:', !modalGone);

  await browser.close();
})();
```

Expected console output: `WIFI QR present: true`, `URL QR present: true`, `Modal closed after Done: true`. Check both screenshots visually: the button appears bottom-right (edit-tiles button stays bottom-left), the QR images render as actual scannable-looking codes (not broken image icons), and the SSID/URL text underneath matches what Task 2's curl check returned.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/hotspotApi.js frontend/src/components/dashboard/ConnectDeviceButton.jsx frontend/src/components/dashboard/ConnectDeviceModal.jsx frontend/src/pages/dashboard/HomePage.jsx
git commit -m "$(cat <<'EOF'
Add Connect Device button and two-step QR modal to the dashboard

Bottom-right button opens a modal that brings up the hotspot and walks
through joining it, then opening VORLAN, via two QR codes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D6cnmvYLvaKHrn3jSfcuHa
EOF
)"
```
