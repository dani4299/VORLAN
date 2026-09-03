# Device onboarding via QR code — design

## Context

VORLAN currently requires a manual, multi-step process to open the app on a
phone or other device: connect the device to the PC's mobile hotspot, then
type the PC's IP/port into the device's browser by hand.

This spec covers replacing that manual process with a "Connect device"
button on the dashboard that shows two QR codes: one to join the PC's
hotspot, one to open VORLAN. It does **not** cover packaging VORLAN as a
standalone desktop app (Electron) — that was raised in the same
conversation but is explicitly deferred to a separate future spec, so more
dashboard UI work can happen first.

## Goals

- One button (bottom-right of the dashboard home screen) starts the flow.
- Scanning QR 1 joins the phone to a WiFi network hosted by the PC.
- Scanning QR 2 opens VORLAN's URL in the phone's browser.
- The PC's own WiFi (internet access) keeps working the whole time —
  losing internet on the PC while hosting the hotspot is not acceptable
  (this was confirmed explicitly during design).
- Linux-only for now (this environment's only testable target). Windows
  support is a known follow-up, not part of this spec.

## Non-goals

- No Electron / standalone desktop app work (separate future spec).
- No single-QR-does-everything flow — no such reliably cross-platform
  format exists, so this is intentionally a two-step, two-QR flow.
- No captive-portal / auto-redirect-on-join magic. Two explicit QR scans.
- No Windows hotspot implementation. The service is structured so one can
  be added later without changing its public interface, but none is
  written now, since it can't be verified without a Windows machine.
- No internet connection-sharing (NAT passthrough) from the PC's WiFi to
  hotspot clients. Phones only need to reach VORLAN's HTTP server on the
  PC, not general internet access through it.

## Hardware/software feasibility (verified on this machine)

- This machine has a single WiFi adapter (`wlp0s20f3`) and no ethernet
  port — confirmed via `ip -brief link show`.
- `iw list` reports this adapter's valid interface combinations include
  `#{ managed } <= 1, #{ AP, P2P-client, P2P-GO } <= 1 ... total <= 3,
  #channels <= 1` — i.e., it can run a managed (client) interface and an
  AP interface at the same time, sharing one channel. This is the same
  trick Windows' Mobile Hotspot uses, and is the reason the PC can host a
  hotspot without losing its own WiFi connection.
- NetworkManager can drive this directly: creating a connection with
  `802-11-wireless.mode ap` and `ipv4.method shared` on the same physical
  device NetworkManager already manages as a client causes NetworkManager
  to create the virtual AP interface, run its own DHCP for it, and keep
  the existing client connection up — no manual `hostapd`/`dnsmasq`
  orchestration needed.
- Reading a WiFi network's *existing* saved password via `nmcli
  -s ... .psk` was not exercised (a permission-sensitive read the sandbox
  blocked by default, and the user redirected away from testing it) — it
  turned out to be unnecessary anyway, since VORLAN generates and owns its
  hotspot's password itself rather than reading anyone else's.

## Architecture

### `backend/src/services/hotspot.service.js` (new)

Linux-only. Owns one NetworkManager connection profile, `VORLAN-Hotspot`.

- **Config persistence**: `backend/hotspot_config.json` (gitignored),
  `{ ssid, password }`. Generated once the first time `ensureHotspot()`
  runs and no config file exists yet; reused on every subsequent
  call/restart so the QR a user scanned once keeps working and the
  password isn't regenerated out from under them.
  - SSID: `VORLAN-<hostname>`, truncated to 32 bytes (the SSID length
    limit) if the hostname is unusually long.
  - Password: 12 characters, alphanumeric only (`A-Za-z0-9`), generated
    with `crypto.randomInt`. Restricting to alphanumeric is a deliberate
    choice, not just a style pick: the `WIFI:` QR payload format requires
    backslash-escaping `;`, `,`, `:`, and `\` inside field values, and an
    alnum-only password sidesteps needing that escaping logic entirely.
    WPA2-PSK accepts 8-63 characters, so 12 is comfortably valid.
- **`ensureHotspot()`**: idempotent.
  1. Load or create `hotspot_config.json`.
  2. Check whether a NetworkManager connection named `VORLAN-Hotspot`
     exists (`nmcli -t -f NAME connection show`).
  3. If not, create it: `nmcli connection add type wifi ifname <device>
     con-name VORLAN-Hotspot autoconnect no ssid <ssid>
     802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared
     wifi-sec.key-mgmt wpa-psk wifi-sec.psk <password>`.
  4. If the connection isn't currently active, activate it:
     `nmcli connection up VORLAN-Hotspot`.
  5. Read back the gateway IP NetworkManager assigned to the AP interface
     (`nmcli -g IP4.ADDRESS device show <ap-iface>`) rather than assuming
     NetworkManager's conventional `10.42.0.1` default, so the QR's URL
     is always correct even if that convention changes.
  6. Return `{ ssid, password, gatewayIp }`.
  - The WiFi device name (`wlp0s20f3` on this machine) is discovered at
    runtime (`nmcli -t -f DEVICE,TYPE device | grep wifi`), not hardcoded,
    so this isn't tied to this specific machine's interface name.
- **Error handling**: any `nmcli` failure (permission denied, device
  busy, unsupported hardware) rejects with a message that gets surfaced
  to the frontend as-is inside an error response — no silent failure, no
  retry loop.
- **Concurrency**: a single in-flight promise is reused if `ensureHotspot()`
  is called again while a previous call hasn't resolved yet, so rapid
  repeated clicks on "Connect device" don't race multiple `nmcli
  connection add` attempts against each other.

### `backend/src/routes/hotspot.routes.js` (new)

One endpoint, auth-protected the same way the rest of the API is
(`verifyToken` middleware):

```
POST /api/hotspot/connect
  -> ensureHotspot()
  -> build WiFi-join QR payload: `WIFI:T:WPA;S:${ssid};P:${password};;`
  -> build URL QR payload: `http://${gatewayIp}:5173`
  -> render both as PNG data URIs via the `qrcode` npm package
  -> respond:
     {
       ssid, password,               // raw values, in case QR scanning fails
       url,                          // the plain URL, same reason
       wifiQr: "data:image/png;base64,...",
       urlQr:  "data:image/png;base64,...",
     }
```

QR generation happens server-side (not in the browser) so the hotspot
logic and QR payload construction stay in one place, and the frontend
only ever handles an `<img>` src.

The URL QR points at port `5173` — the Vite dev server port phones are
already told to visit today. This matches the current manual process
being automated; it is not meant to anticipate the deferred Electron
work, which will revisit how the app is served in production.

### Frontend

- **`frontend/src/components/dashboard/ConnectDeviceButton.jsx`** (new) —
  an `IconButton` fixed to the bottom-right of `HomePage`, mirroring the
  existing bottom-left "Edit tiles" button's `overlay`/`overlayTone`
  styling so it reads as part of the same UI family.
- **`frontend/src/components/dashboard/ConnectDeviceModal.jsx`** (new) —
  portal-rendered modal (reuses the existing `Modal` component), two
  internal steps:
  1. **Join network**: renders `wifiQr`, shows the SSID as text under it
     (for manual entry as a fallback if scanning fails), "Next" button.
  2. **Open VORLAN**: renders `urlQr`, shows the plain URL as text
     underneath, "Done" button that closes the modal.
  - On open, calls `POST /api/hotspot/connect` once and shows a loading
    spinner until it resolves (bringing the hotspot up for the first time
    can take a few seconds); an error response renders an inline error
    state with a "Try again" retry button rather than a silent failure.
- **`frontend/src/lib/hotspotApi.js`** (new) — thin wrapper, `connectDevice()`
  calling the endpoint above, following the existing pattern in
  `frontend/src/lib/explorerApi.js`.

## Data flow

```
[User clicks "Connect device"]
        |
        v
ConnectDeviceModal opens, calls POST /api/hotspot/connect
        |
        v
hotspot.routes.js -> hotspot.service.js ensureHotspot()
        |                         |
        |                 nmcli connection add/up (if needed)
        |                         |
        |                 read back gateway IP
        v
route builds two QR data URIs, responds
        |
        v
Modal shows QR 1 (join hotspot) -> user scans, joins WiFi
        |
   [user taps "Next"]
        v
Modal shows QR 2 (open VORLAN) -> user scans, opens URL in phone browser
        |
   [user taps "Done"]
        v
Modal closes
```

## Error handling

- `nmcli` not installed / not Linux: `ensureHotspot()` rejects immediately
  with a clear "not supported on this system" message rather than
  attempting anything.
- `nmcli connection add`/`up` failure (permission denied, adapter busy,
  unsupported driver): surfaced verbatim to the modal's error state.
- Backend unreachable / request timeout: same inline error state, "Try
  again" retry re-calls the endpoint (safe — `ensureHotspot()` is
  idempotent).

## Testing plan

- **Backend**: manually exercised end-to-end on this machine via curl —
  confirm `POST /api/hotspot/connect` actually brings up a real
  `VORLAN-Hotspot` NetworkManager connection (`nmcli connection show
  --active`), confirm the existing WiFi connection (`Daniyal`) stays
  active at the same time, confirm the returned gateway IP matches what
  NetworkManager actually assigned, confirm calling it twice in a row is
  a fast no-op the second time.
- **Frontend**: Playwright — click "Connect device", confirm the modal
  opens, confirm both QR images render (non-empty `data:image/png`
  sources) after stepping through "Next", confirm "Done" closes the
  modal, confirm an error state renders and "Try again" works when the
  backend call is made to fail.
- **What cannot be verified in this environment**: an actual phone
  scanning either QR and successfully joining/opening VORLAN. That
  requires physical testing on a real device after implementation, by
  the user.

## Open follow-ups (explicitly out of scope here)

- Windows hotspot implementation (separate `HotspotProvider`-shaped
  service, written and tested only once a Windows machine is available).
- Electron desktop packaging (separate spec, deferred at the user's
  request).
- Anything cleverer than two sequential QR codes (e.g. captive-portal
  auto-redirect) — not pursued; YAGNI given the two-step flow already
  meets the stated goal.
