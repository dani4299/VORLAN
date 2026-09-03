# Linux Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Download HERE" link in VORLAN's GitHub README that starts a real browser download of a single installer file; opening the downloaded file runs a wizard that installs Node/npm, Ollama + `phi3`, linux-wifi-hotspot, and VORLAN itself on Fedora or Debian/Ubuntu, adds VORLAN to the application menu, and wires the hotspot to start whenever VORLAN is launched (not at boot) — while never breaking the existing QR "Connect a device" flow phones/tablets use, and never double-installing or erroring on dependencies the user already has.

**Architecture:** A layered shell-script installer: `lib/ui.sh` abstracts whichever dialog tool is present (zenity/kdialog/whiptail), `lib/pkg.sh` abstracts dnf/apt, `lib/steps.sh` holds pure, UI-agnostic, idempotent check-then-install functions for each dependency, and `install.sh` orchestrates them into the welcome→config→progress→done wizard. One privileged script (`install-system-deps.sh`) does every step needing root via a single `pkexec` call. `install.sh` self-bootstraps (clones the repo to fetch its own `lib/`/`desktop/` siblings) when run as the standalone file it's actually downloaded as, since it's published as a GitHub Release asset (the only reliable way to make a README link force a real browser download) rather than distributed alongside its sibling files. Separately, `backend/server.js` gains production static-serving and `connect-qr` gains a dynamic port, so the existing mobile QR flow keeps working once VORLAN is installed (not run from a dev checkout).

**Tech Stack:** Bash (installer), existing Node/Express backend, existing React/Vite frontend. No new frontend dependencies. No new backend dependencies for Task 1 (uses Express's built-in `express.static`, already a dependency).

**Spec:** `docs/superpowers/specs/2026-09-04-linux-installer-design.md`

## Global Constraints

- **Idempotency is mandatory, not optional.** Every install step (Node, Ollama, the `phi3` model, linux-wifi-hotspot) checks whether it's already present/usable *first*, and skips with a clear "already installed" status if so. Never blindly re-run an install command, and never treat "already installed" as an error. This directly satisfies the user's explicit requirement: don't double-install, don't error, if something's already there.
- **Never execute real system-mutating commands (package installs, `make install`, `systemctl enable`, `pkexec`) against a live development machine during this implementation's own verification**, except where the thing being installed is trivially small/reversible (e.g. `whiptail`, a ~50KB terminal-dialog package) or the step is *guaranteed* to resolve to "already installed, skip" on this exact machine (verified below: Node, Ollama, `phi3`, and `linux-wifi-hotspot`/`create_ap` are all already installed here). Every step's *"not yet installed"* branch is verified via a dry-run mode (see below), syntax checks, and code review against documented package names — not a real fresh install.
- **Dry-run mode**: every function in `lib/pkg.sh` and `lib/steps.sh` that would run a real mutating command checks `"${VORLAN_DRY_RUN:-}"` first; if set to `1`, it echoes the exact command it would have run (prefixed `[DRY RUN]`) and returns `0` instead of executing it. This is how the "not yet installed" branches get tested for real without touching system state.
- **This machine's actual state** (checked directly, informs which real-install paths can be verified for real vs. dry-run only): Fedora 44, `dnf` present, no `apt`/`docker`. Node 22 (`nodejs22-bin`), Ollama 0.12.11, and `linux-wifi-hotspot` 4.7.2 (includes `create_ap`) are all already installed via `dnf`. The `phi3` model is already pulled. No `zenity`/`kdialog`/`whiptail`/`dialog` present at all.
- **linux-wifi-hotspot on Fedora is a native `dnf` package** (`dnf install linux-wifi-hotspot`) — confirmed present in Fedora's own repos on this machine, not just via COPR. This is simpler than the spec's original "build from source on both distros" assumption; Debian/Ubuntu still needs the build-from-source path (no universal apt package), which is unchanged from the spec.
- Package name lists (verbatim from the spec, from linux-wifi-hotspot's own docs):
  - Debian/Ubuntu build deps: `libgtk-3-dev build-essential gcc g++ pkg-config make hostapd libqrencode-dev libpng-dev`
  - Fedora build deps (only used if the native package is ever unavailable — not expected in practice): `gtk3-devel gcc gcc-c++ kernel-devel pkg-config make hostapd qrencode-devel libpng-devel`
- Hotspot config file: `/etc/create_ap.conf`. WiFi network name default: `VORLAN-<hostname>`. Password: 12 random alphanumeric characters (same shape as the existing, unused `backend/src/services/hotspot.service.js`).
- The `create_ap` systemd service is never enabled at boot by this installer (`systemctl enable create_ap` is never called) — it starts on demand from VORLAN's own launcher.
- No Electron, no uninstaller, no distros beyond Fedora/Debian-Ubuntu, no auto-stop-on-close — all explicitly out of scope per the spec.
- All new installer files live under `installer/` at the repo root.

---

### Task 1: Backend production serving + `connect-qr` port fix

**Files:**
- Modify: `backend/src/config/paths.js`
- Modify: `backend/server.js`
- Modify: `backend/src/routes/system.routes.js`

**Interfaces:**
- Produces: `paths.js` exports a new `FRONTEND_DIST_DIR` constant (`path.join(ROOT_DIR, '..', 'frontend', 'dist')`) and a new `FRONTEND_INDEX_HTML` constant (`path.join(FRONTEND_DIST_DIR, 'index.html')`), consumed by both `server.js` and `system.routes.js`.
- Produces: `server.js`, when `FRONTEND_INDEX_HTML` exists, serves the frontend's static build and a SPA fallback for any unmatched non-API/non-media GET route.
- Produces: `system.routes.js`'s `connect-qr` route returns a URL pointing at `PORT` (the backend's own port) when `FRONTEND_INDEX_HTML` exists, or `5173` otherwise (unchanged dev behavior).

- [ ] **Step 1: Add the new path constants**

In `backend/src/config/paths.js`, add alongside the existing exports:

```javascript
  DEVICES_FILE: path.join(ROOT_DIR, 'devices.json'),
  FRONTEND_DIST_DIR: path.join(ROOT_DIR, '..', 'frontend', 'dist'),
  FRONTEND_INDEX_HTML: path.join(ROOT_DIR, '..', 'frontend', 'dist', 'index.html'),
};
```

(This replaces the file's final `};` — the `DEVICES_FILE` line already exists; just add the two new lines before the closing brace.)

- [ ] **Step 2: Verify the constants resolve correctly**

```bash
cd backend && node -e "console.log(require('./src/config/paths').FRONTEND_DIST_DIR); console.log(require('./src/config/paths').FRONTEND_INDEX_HTML)"
```

Expected: two absolute paths ending in `frontend/dist` and `frontend/dist/index.html`.

- [ ] **Step 3: Serve the production build in `server.js`**

In `backend/server.js`, the current file (after the recent devices-routes work) has this shape near the top:

```javascript
const { GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR } = require('./src/config/paths');
```

Change that import line to also pull in the two new constants:

```javascript
const { GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR, FRONTEND_DIST_DIR, FRONTEND_INDEX_HTML } = require('./src/config/paths');
```

Add `fs` to the top-of-file requires (it isn't currently imported in `server.js`):

```javascript
const fs = require('fs');
```

Immediately after the last `app.use('/api/...', ...)` line (currently `app.use('/api/devices', devicesRoutes);`), add:

```javascript
// Serves the frontend's production build when one exists (an installed copy of VORLAN) - a plain
// dev checkout with no build present skips this entirely, so `npm start`'s Vite dev server
// workflow is completely unaffected. BrowserRouter is used on the frontend, so any non-API,
// non-media route needs to fall back to index.html for client-side routing to work - otherwise a
// phone opening a deep link like /dashboard/ai directly would get a 404 instead of the app shell.
if (fs.existsSync(FRONTEND_INDEX_HTML)) {
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get(/^(?!\/api|\/media).*/, (req, res) => {
    res.sendFile(FRONTEND_INDEX_HTML);
  });
}
```

- [ ] **Step 4: Point `connect-qr` at the right port**

In `backend/src/routes/system.routes.js`, the current top of the file is:

```javascript
const express = require('express');
const os = require('os');
const si = require('systeminformation');
const QRCode = require('qrcode');
const verifyToken = require('../middleware/auth.middleware');
const storage = require('../services/storage.service');
const { getLocalIp } = require('../utils/localIp');

const router = express.Router();

// The Vite dev server port phones are already told to visit today - matches the existing
// manual "type the IP into the browser" process this QR code replaces.
const FRONTEND_PORT = 5173;

router.get('/connect-qr', verifyToken, async (req, res) => {
  try {
    const url = `http://${getLocalIp()}:${FRONTEND_PORT}`;
    const qr = await QRCode.toDataURL(url);
    res.json({ url, qr });
  } catch (err) {
    console.error('Failed to generate connect QR code:', err);
    res.status(500).json({ error: "Couldn't generate the QR code. Please try again." });
  }
});
```

Replace the `require`s, the `FRONTEND_PORT` constant, and the route body with:

```javascript
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
```

- [ ] **Step 5: Verify dev mode is unaffected (no build present)**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
rm -rf frontend/dist
# restart the backend so it picks up the code changes
pkill -f "node server.js" 2>/dev/null; sleep 1
(cd backend && node server.js > /tmp/backend_test.log 2>&1 &)
sleep 2
U="devplan_$(date +%s)"; P="Password123!"
curl -s -X POST http://localhost:5000/api/auth/signup -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\",\"email\":\"$U@example.com\"}" >/dev/null
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s http://localhost:5000/api/system/connect-qr -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])"
curl -s -o /dev/null -w "root path status (no build): %{http_code}\n" http://localhost:5000/
```

Expected: the printed URL ends in `:5173` (unchanged dev behavior), and the root path returns `404` (no static frontend served, since `frontend/dist` doesn't exist).

- [ ] **Step 6: Verify production mode (build present)**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master/frontend
npm run build
pkill -f "node server.js" 2>/dev/null; sleep 1
(cd ../backend && node server.js > /tmp/backend_test.log 2>&1 &)
sleep 2
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
U="devplan2_$(date +%s)"; P="Password123!"
curl -s -X POST http://localhost:5000/api/auth/signup -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\",\"email\":\"$U@example.com\"}" >/dev/null
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s http://localhost:5000/api/system/connect-qr -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])"
curl -s -o /dev/null -w "root path status (build present): %{http_code}\n" http://localhost:5000/
curl -s -o /dev/null -w "deep client-side route status: %{http_code}\n" http://localhost:5000/dashboard/ai
curl -s http://localhost:5000/dashboard/ai | grep -o "<title>[^<]*" | head -1
```

Expected: the printed URL ends in `:5000` (production behavior), the root path and the deep route (`/dashboard/ai`, which doesn't exist as a file) both return `200` and the deep route's HTML contains `<title>VORLAN` — proving the SPA fallback serves the app shell rather than a 404, exactly the regression this task exists to prevent.

- [ ] **Step 7: Commit**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
git add backend/src/config/paths.js backend/server.js backend/src/routes/system.routes.js
git commit -m "$(cat <<'EOF'
Serve a production frontend build from the backend when present

Adds FRONTEND_DIST_DIR/FRONTEND_INDEX_HTML to paths.js. server.js now
serves frontend/dist (with a SPA fallback for BrowserRouter's
client-side routes) whenever a production build exists, leaving the
existing Vite-dev-server workflow (no build present) untouched.
connect-qr now points at the backend's own port in that case instead
of always assuming the Vite dev server on 5173 - keeps the existing
QR "Connect a device" flow working for phones/tablets once VORLAN is
installed via the upcoming Linux installer rather than run from a dev
checkout.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 2: `installer/lib/ui.sh` — dialog-backend abstraction

**Files:**
- Create: `installer/lib/ui.sh`

**Interfaces:**
- Consumes: `pkg_install_single <dnf-name> <apt-name>` from Task 3's `lib/pkg.sh` (to install `whiptail` if no backend is found) - this task is written first but sources `pkg.sh`, so **do Task 3 before running this task's verification steps**, or verify Task 2's detection logic standalone first and the whiptail-auto-install path after Task 3 exists. The step order below handles this.
- Produces: `UI_BACKEND` (global, set by `ui_detect_backend`, one of `zenity`/`kdialog`/`whiptail`), `ui_message TITLE TEXT`, `ui_input TITLE LABEL DEFAULT` (echoes result to stdout, returns 1 if cancelled), `ui_password TITLE LABEL` (echoes result to stdout, returns 1 if cancelled), `ui_confirm TITLE TEXT` (returns 0 for yes, 1 for no), `ui_progress_start TITLE`, `ui_progress_update PERCENT STATUS`, `ui_progress_done`, `ui_error TITLE TEXT`.

- [ ] **Step 1: Write `installer/lib/ui.sh`**

```bash
#!/usr/bin/env bash
# Dialog-backend abstraction: detects whichever GUI dialog tool is present
# (zenity, kdialog) and falls back to whiptail (terminal-based, installed on
# the spot if entirely missing - it's a tiny package present in every major
# distro's base repos). Every other installer script only calls the ui_*
# functions below, never zenity/kdialog/whiptail directly.

UI_BACKEND=""
_UI_PROGRESS_FIFO=""
_UI_PROGRESS_PID=""
_UI_PROGRESS_FD=""

ui_detect_backend() {
  if command -v zenity >/dev/null 2>&1; then
    UI_BACKEND="zenity"
  elif command -v kdialog >/dev/null 2>&1; then
    UI_BACKEND="kdialog"
  elif command -v whiptail >/dev/null 2>&1; then
    UI_BACKEND="whiptail"
  else
    echo "No dialog tool found (zenity/kdialog/whiptail) - installing whiptail as a fallback." >&2
    pkg_install_single "newt" "whiptail"
    if command -v whiptail >/dev/null 2>&1; then
      UI_BACKEND="whiptail"
    else
      echo "Could not install a dialog tool. Aborting." >&2
      return 1
    fi
  fi
  echo "Using dialog backend: $UI_BACKEND" >&2
  return 0
}

ui_message() {
  local title="$1" text="$2"
  case "$UI_BACKEND" in
    zenity) zenity --info --title="$title" --text="$text" ;;
    kdialog) kdialog --title "$title" --msgbox "$text" ;;
    whiptail) whiptail --title "$title" --msgbox "$text" 10 60 ;;
  esac
}

ui_input() {
  local title="$1" label="$2" default="$3"
  case "$UI_BACKEND" in
    zenity) zenity --entry --title="$title" --text="$label" --entry-text="$default" ;;
    kdialog) kdialog --title "$title" --inputbox "$label" "$default" ;;
    whiptail) whiptail --title "$title" --inputbox "$label" 10 60 "$default" 3>&1 1>&2 2>&3 ;;
  esac
}

ui_password() {
  local title="$1" label="$2"
  case "$UI_BACKEND" in
    zenity) zenity --password --title="$title" ;;
    kdialog) kdialog --title "$title" --password "$label" ;;
    whiptail) whiptail --title "$title" --passwordbox "$label" 10 60 3>&1 1>&2 2>&3 ;;
  esac
}

ui_confirm() {
  local title="$1" text="$2"
  case "$UI_BACKEND" in
    zenity) zenity --question --title="$title" --text="$text" ;;
    kdialog) kdialog --title "$title" --yesno "$text" ;;
    whiptail) whiptail --title "$title" --yesno "$text" 10 60 ;;
  esac
}

ui_error() {
  local title="$1" text="$2"
  case "$UI_BACKEND" in
    zenity) zenity --error --title="$title" --text="$text" ;;
    kdialog) kdialog --title "$title" --error "$text" ;;
    whiptail) whiptail --title "$title" --msgbox "ERROR: $text" 12 60 ;;
  esac
}

# Opens a persistent progress dialog. Call ui_progress_update repeatedly, then ui_progress_done.
ui_progress_start() {
  local title="$1"
  _UI_PROGRESS_FIFO="$(mktemp -u)"
  mkfifo "$_UI_PROGRESS_FIFO"
  case "$UI_BACKEND" in
    zenity)
      zenity --progress --title="$title" --percentage=0 --auto-close < "$_UI_PROGRESS_FIFO" &
      _UI_PROGRESS_PID=$!
      ;;
    kdialog)
      # kdialog has no fifo-driven mode; track a reference and call it directly from ui_progress_update.
      _UI_PROGRESS_REF=$(kdialog --title "$title" --progressbar "Starting..." 100)
      rm -f "$_UI_PROGRESS_FIFO"
      _UI_PROGRESS_FIFO=""
      return 0
      ;;
    whiptail)
      whiptail --title "$title" --gauge "Starting..." 10 70 0 < "$_UI_PROGRESS_FIFO" &
      _UI_PROGRESS_PID=$!
      ;;
  esac
  exec 9> "$_UI_PROGRESS_FIFO"
  _UI_PROGRESS_FD=9
}

ui_progress_update() {
  local percent="$1" status="$2"
  case "$UI_BACKEND" in
    zenity)
      echo "$percent" >&9
      echo "# $status" >&9
      ;;
    kdialog)
      qdbus "$_UI_PROGRESS_REF" Set "" value "$percent" >/dev/null 2>&1
      qdbus "$_UI_PROGRESS_REF" setLabelText "$status" >/dev/null 2>&1
      ;;
    whiptail)
      { echo "XXX"; echo "$percent"; echo "$status"; echo "XXX"; } >&9
      ;;
  esac
}

ui_progress_done() {
  case "$UI_BACKEND" in
    zenity|whiptail)
      exec 9>&-
      wait "$_UI_PROGRESS_PID" 2>/dev/null
      rm -f "$_UI_PROGRESS_FIFO"
      ;;
    kdialog)
      qdbus "$_UI_PROGRESS_REF" close >/dev/null 2>&1
      ;;
  esac
  _UI_PROGRESS_FIFO=""
  _UI_PROGRESS_PID=""
}
```

- [ ] **Step 2: Syntax-check it**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
mkdir -p installer/lib
bash -n installer/lib/ui.sh && echo "ui.sh: syntax OK"
```

Expected: `ui.sh: syntax OK`

- [ ] **Step 3: Verify detection logic in isolation (before `pkg.sh` exists)**

`ui_detect_backend` calls `pkg_install_single` only in the "nothing found" branch. Since this machine currently has none of the three tools, stub that function out for now to verify the detection/fallback *logic* independent of Task 3:

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -c '
  source installer/lib/ui.sh
  pkg_install_single() { echo "[stub] would install: dnf=$1 apt=$2" >&2; }
  ui_detect_backend
  echo "UI_BACKEND=$UI_BACKEND"
'
```

Expected output includes `No dialog tool found...`, `[stub] would install: dnf=newt apt=whiptail`, and (since the stub does not actually install anything) `Could not install a dialog tool. Aborting.` with a non-zero return — this is correct: it proves the fallback chain and the call into `pkg_install_single` both fire in the right order and with the right arguments; Task 3 makes this succeed for real.

- [ ] **Step 4: Commit**

```bash
git add installer/lib/ui.sh
git commit -m "$(cat <<'EOF'
Add installer dialog-backend abstraction (zenity/kdialog/whiptail)

ui.sh detects whichever GUI dialog tool is present, falling back to
whiptail (auto-installed if none found - a tiny, universally-packaged
terminal dialog tool). Every wizard screen in the rest of the
installer goes through this one layer's ui_* functions, so the
detection logic lives in exactly one place.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 3: `installer/lib/pkg.sh` — package-manager abstraction

**Files:**
- Create: `installer/lib/pkg.sh`

**Interfaces:**
- Produces: `PKG_MANAGER` (global, set by `pkg_detect`, one of `dnf`/`apt`/empty), `pkg_detect` (returns 0 if supported, 1 otherwise), `pkg_install_single <dnf-name> <apt-name>` (installs one package under whichever manager is detected), `pkg_install_list <dnf-space-separated-names> <apt-space-separated-names>` (installs a whole list at once - used for linux-wifi-hotspot's build deps). Both respect `VORLAN_DRY_RUN`.
- Consumes: nothing (no dependency on other installer files).

- [ ] **Step 1: Write `installer/lib/pkg.sh`**

```bash
#!/usr/bin/env bash
# dnf/apt abstraction. Every other installer script calls pkg_install_single /
# pkg_install_list instead of dnf/apt-get directly, so the "which distro" logic
# lives in exactly one place.

PKG_MANAGER=""

pkg_detect() {
  if command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
  elif command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt"
  else
    PKG_MANAGER=""
    return 1
  fi
  return 0
}

_pkg_run() {
  # $@ is the full command to run (or echo, in dry-run mode)
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] $*"
    return 0
  fi
  "$@"
}

pkg_install_single() {
  local dnf_name="$1" apt_name="$2"
  case "$PKG_MANAGER" in
    dnf) _pkg_run sudo dnf install -y "$dnf_name" ;;
    apt) _pkg_run sudo apt-get install -y "$apt_name" ;;
    *) echo "pkg_install_single: no package manager detected" >&2; return 1 ;;
  esac
}

pkg_install_list() {
  local dnf_names="$1" apt_names="$2"
  case "$PKG_MANAGER" in
    dnf) _pkg_run sudo dnf install -y $dnf_names ;;
    apt) _pkg_run sudo apt-get install -y $apt_names ;;
    *) echo "pkg_install_list: no package manager detected" >&2; return 1 ;;
  esac
}
```

- [ ] **Step 2: Syntax-check it**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -n installer/lib/pkg.sh && echo "pkg.sh: syntax OK"
```

- [ ] **Step 3: Verify real detection on this machine (dnf)**

```bash
bash -c 'source installer/lib/pkg.sh; pkg_detect; echo "PKG_MANAGER=$PKG_MANAGER"'
```

Expected: `PKG_MANAGER=dnf`

- [ ] **Step 4: Verify dry-run command construction for both managers**

```bash
bash -c '
  source installer/lib/pkg.sh
  export VORLAN_DRY_RUN=1
  echo "--- forcing dnf ---"
  PKG_MANAGER=dnf
  pkg_install_list "gtk3-devel gcc gcc-c++ kernel-devel pkg-config make hostapd qrencode-devel libpng-devel" "libgtk-3-dev build-essential gcc g++ pkg-config make hostapd libqrencode-dev libpng-dev"
  echo "--- forcing apt ---"
  PKG_MANAGER=apt
  pkg_install_list "gtk3-devel gcc gcc-c++ kernel-devel pkg-config make hostapd qrencode-devel libpng-devel" "libgtk-3-dev build-essential gcc g++ pkg-config make hostapd libqrencode-dev libpng-dev"
'
```

Expected: two `[DRY RUN] sudo dnf install -y ...`/`[DRY RUN] sudo apt-get install -y ...` lines, each listing the *correct* package names for that manager (Fedora names under `dnf`, Debian/Ubuntu names under `apt`) - this is the real, meaningful verification of the apt path, since no Debian machine/container is available here (matches the spec's disclosed testing limitation).

- [ ] **Step 5: Verify unsupported-manager handling**

```bash
bash -c '
  source installer/lib/pkg.sh
  PKG_MANAGER=""
  pkg_install_single foo bar
  echo "exit code: $?"
'
```

Expected: `pkg_install_single: no package manager detected` and `exit code: 1` - confirms a clear, immediate failure rather than a crash or silent no-op.

- [ ] **Step 6: Re-run Task 2's Step 3 for real, now that `pkg.sh` exists**

This actually installs `whiptail` (a ~50KB package - the one real system-mutating install this plan performs during its own verification, per the Global Constraints exception for trivial/reversible packages):

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -c '
  source installer/lib/pkg.sh
  source installer/lib/ui.sh
  pkg_detect
  ui_detect_backend
  echo "UI_BACKEND=$UI_BACKEND"
'
command -v whiptail && echo "whiptail is now installed"
```

Expected: `UI_BACKEND=whiptail`, and `whiptail` is now present on the system - proves the full "nothing found → install a fallback → use it" chain works for real, end to end.

- [ ] **Step 7: Commit**

```bash
git add installer/lib/pkg.sh
git commit -m "$(cat <<'EOF'
Add installer package-manager abstraction (dnf/apt)

pkg.sh detects dnf vs apt and exposes pkg_install_single/
pkg_install_list, both respecting VORLAN_DRY_RUN so the "not yet
installed" branches of every install step can be verified (correct
command, correct package names per distro) without actually mutating
system state. Unsupported managers fail immediately and clearly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 4: `installer/lib/steps.sh` — dependency detection and install logic

**Files:**
- Create: `installer/lib/steps.sh`

**Interfaces:**
- Consumes: `pkg_detect`, `pkg_install_single`, `pkg_install_list`, `PKG_MANAGER` (Task 3).
- Produces (all pure logic, no UI calls - `install.sh` and `install-system-deps.sh` call these and translate results into `ui_*` calls): `step_check_node` (0=present&usable, 1=missing/too old), `step_install_node`, `step_check_ollama`, `step_install_ollama`, `step_check_model MODEL`, `step_pull_model MODEL`, `step_check_hotspot_tool`, `step_install_hotspot_tool`, `step_write_hotspot_config SSID PASSWORD IFACE`, `step_detect_wifi_iface` (echoes the first WiFi device name to stdout), `step_clone_or_update_vorlan INSTALL_DIR`, `step_build_vorlan INSTALL_DIR`.

- [ ] **Step 1: Write `installer/lib/steps.sh`**

```bash
#!/usr/bin/env bash
# Pure, idempotent check-then-install functions for each VORLAN dependency.
# No UI calls here - install.sh and install-system-deps.sh translate results
# into ui_* calls, so these functions are usable/testable standalone.

VORLAN_REPO_URL="https://github.com/dani4299/VORLAN.git"
HOTSPOT_TOOL_REPO_URL="https://github.com/lakinduakash/linux-wifi-hotspot.git"

# --- Node.js / npm ---

step_check_node() {
  command -v node >/dev/null 2>&1 || return 1
  command -v npm >/dev/null 2>&1 || return 1
  local major
  major=$(node -e "console.log(process.versions.node.split('.')[0])")
  [ "$major" -ge 18 ]
}

step_install_node() {
  case "$PKG_MANAGER" in
    dnf)
      pkg_install_single "nodejs" "" ;;
    apt)
      if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
        echo "[DRY RUN] curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
        echo "[DRY RUN] sudo apt-get install -y nodejs"
      else
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
      fi
      ;;
    *) echo "step_install_node: no package manager detected" >&2; return 1 ;;
  esac
}

# --- Ollama ---

step_check_ollama() {
  command -v ollama >/dev/null 2>&1
}

step_install_ollama() {
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] curl -fsSL https://ollama.com/install.sh | sh"
    return 0
  fi
  curl -fsSL https://ollama.com/install.sh | sh
}

step_check_model() {
  local model="$1"
  ollama list 2>/dev/null | awk '{print $1}' | grep -qE "^${model}(:latest)?\$"
}

step_pull_model() {
  local model="$1"
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] ollama pull $model"
    return 0
  fi
  ollama pull "$model"
}

# --- linux-wifi-hotspot / create_ap ---

step_check_hotspot_tool() {
  command -v create_ap >/dev/null 2>&1
}

step_install_hotspot_tool() {
  case "$PKG_MANAGER" in
    dnf)
      # Fedora carries linux-wifi-hotspot in its own repos - no build-from-source needed.
      pkg_install_single "linux-wifi-hotspot" "" ;;
    apt)
      # No universal apt package - build from source per the project's own documented steps.
      pkg_install_list "" "libgtk-3-dev build-essential gcc g++ pkg-config make hostapd libqrencode-dev libpng-dev"
      if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
        echo "[DRY RUN] git clone $HOTSPOT_TOOL_REPO_URL /tmp/linux-wifi-hotspot"
        echo "[DRY RUN] make -C /tmp/linux-wifi-hotspot && sudo make -C /tmp/linux-wifi-hotspot install"
        return 0
      fi
      rm -rf /tmp/linux-wifi-hotspot
      git clone "$HOTSPOT_TOOL_REPO_URL" /tmp/linux-wifi-hotspot
      make -C /tmp/linux-wifi-hotspot
      sudo make -C /tmp/linux-wifi-hotspot install
      ;;
    *) echo "step_install_hotspot_tool: no package manager detected" >&2; return 1 ;;
  esac
}

step_detect_wifi_iface() {
  if command -v nmcli >/dev/null 2>&1; then
    nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}'
  fi
}

step_write_hotspot_config() {
  local ssid="$1" password="$2" iface="$3"
  local content
  content=$(cat <<EOF
INTERNET_IFACE=$iface
WIFI_IFACE=$iface
SSID=$ssid
PASSPHRASE=$password
CHANNEL=default
EOF
)
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] write /etc/create_ap.conf:"
    echo "$content"
    return 0
  fi
  echo "$content" | sudo tee /etc/create_ap.conf >/dev/null
}

# --- VORLAN itself (no root needed for any of this) ---

step_clone_or_update_vorlan() {
  local install_dir="$1"
  if [ -d "$install_dir/.git" ]; then
    (cd "$install_dir" && git pull --ff-only)
  else
    git clone "$VORLAN_REPO_URL" "$install_dir"
  fi
}

step_build_vorlan() {
  local install_dir="$1"
  (cd "$install_dir" && npm install) || return 1
  (cd "$install_dir/backend" && npm install) || return 1
  (cd "$install_dir/frontend" && npm install && npm run build) || return 1
}
```

- [ ] **Step 2: Syntax-check it**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -n installer/lib/steps.sh && echo "steps.sh: syntax OK"
```

- [ ] **Step 3: Verify every "already installed" branch for real (safe on this machine - everything is already present, so no install command ever actually fires)**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -c '
  source installer/lib/pkg.sh
  source installer/lib/steps.sh
  pkg_detect

  step_check_node && echo "node: already OK" || echo "node: MISSING"
  step_check_ollama && echo "ollama: already OK" || echo "ollama: MISSING"
  step_check_model phi3 && echo "phi3: already pulled" || echo "phi3: MISSING"
  step_check_hotspot_tool && echo "create_ap: already OK" || echo "create_ap: MISSING"
  echo "detected wifi iface: $(step_detect_wifi_iface)"
'
```

Expected: `node: already OK`, `ollama: already OK`, `phi3: already pulled`, `create_ap: already OK`, and a real interface name (e.g. `wlp0s20f3`) - every check correctly reports "already there" with zero installs attempted, directly demonstrating the idempotency requirement end to end for real.

- [ ] **Step 4: Verify the "not yet installed" branches via dry-run (can't be true on this machine, so simulate by testing the install functions directly)**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -c '
  source installer/lib/pkg.sh
  source installer/lib/steps.sh
  pkg_detect
  export VORLAN_DRY_RUN=1

  echo "--- node (dnf, this machine) ---"
  step_install_node
  echo "--- node (apt, forced) ---"
  PKG_MANAGER=apt step_install_node
  echo "--- ollama ---"
  step_install_ollama
  echo "--- phi3 pull ---"
  step_pull_model phi3
  echo "--- hotspot tool (dnf, this machine) ---"
  step_install_hotspot_tool
  echo "--- hotspot tool (apt, forced) ---"
  PKG_MANAGER=apt step_install_hotspot_tool
  echo "--- create_ap.conf ---"
  step_write_hotspot_config "VORLAN-testhost" "abc123XYZ789" "wlp0s20f3"
'
```

Expected: every line is prefixed `[DRY RUN]` (or, for `step_write_hotspot_config`, shows the file content it would write), listing the correct real commands and package names for each path (`dnf install -y nodejs` vs the NodeSource+`apt-get install -y nodejs` pair; `dnf install -y linux-wifi-hotspot` vs the apt build-deps list plus `git clone`/`make`/`make install`). No file is actually written, no package actually installed.

- [ ] **Step 5: Verify VORLAN clone/build logic against a throwaway directory (safe - only touches a temp dir, and this doesn't need dry-run since it's just a git clone + npm install, not a system package change)**

```bash
rm -rf /tmp/vorlan-install-test
bash -c '
  source /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master/installer/lib/steps.sh
  step_clone_or_update_vorlan /tmp/vorlan-install-test
'
ls /tmp/vorlan-install-test/backend/server.js && echo "clone: OK"
bash -c '
  source /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master/installer/lib/steps.sh
  step_clone_or_update_vorlan /tmp/vorlan-install-test
'
echo "re-run (should git pull, not re-clone): exit $?"
rm -rf /tmp/vorlan-install-test
```

Expected: the clone succeeds (`backend/server.js` exists in the temp dir), and running it a second time against the same directory does a `git pull` rather than erroring about the directory already existing - confirms idempotency for this step too.

- [ ] **Step 6: Commit**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
git add installer/lib/steps.sh
git commit -m "$(cat <<'EOF'
Add installer dependency check/install logic (steps.sh)

Pure, UI-agnostic, idempotent step_check_*/step_install_* functions
for Node/npm, Ollama, the phi3 model, and linux-wifi-hotspot, plus
VORLAN's own clone-or-update and build steps. Every check runs first
and skips the install if already satisfied - verified for real on
this machine, where every dependency already happens to be installed,
so every branch correctly resolves to "already there" with zero
installs actually attempted. The "not yet installed" branches are
verified via VORLAN_DRY_RUN instead of a real fresh install, to avoid
mutating a live development machine's package set.

Fedora gets linux-wifi-hotspot from its own dnf repos directly (no
build-from-source needed there, unlike the original spec's assumption
- confirmed present as a native package on this machine); Debian/
Ubuntu still builds from source per the project's documented steps.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 5: `installer/lib/install-system-deps.sh` — the one privileged script

**Files:**
- Create: `installer/lib/install-system-deps.sh`

**Interfaces:**
- Consumes: `pkg_detect` (Task 3), `step_check_node`/`step_install_node`/`step_check_ollama`/`step_install_ollama`/`step_check_hotspot_tool`/`step_install_hotspot_tool`/`step_write_hotspot_config`/`step_detect_wifi_iface` (Task 4).
- Produces: a script invoked as `pkexec /path/to/install-system-deps.sh <ssid> <password>` (or directly as root) that performs every privileged step and exits non-zero on the first failure, printing which step failed to stderr.

- [ ] **Step 1: Write `installer/lib/install-system-deps.sh`**

```bash
#!/usr/bin/env bash
# The ONE script in this installer that runs as root - invoked once via a
# single pkexec call so there's exactly one graphical password prompt for
# the whole install, not one per privileged step. Takes the chosen WiFi
# network name and password as $1/$2.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pkg.sh"
source "$SCRIPT_DIR/steps.sh"

SSID="${1:?Usage: install-system-deps.sh <ssid> <password>}"
PASSWORD="${2:?Usage: install-system-deps.sh <ssid> <password>}"

if ! pkg_detect; then
  echo "STEP_FAILED: unsupported package manager (need dnf or apt)" >&2
  exit 1
fi

if step_check_node; then
  echo "STEP_OK: Node.js/npm already installed"
else
  echo "STEP_START: Installing Node.js/npm"
  step_install_node || { echo "STEP_FAILED: Node.js/npm install failed" >&2; exit 1; }
fi

if step_check_ollama; then
  echo "STEP_OK: Ollama already installed"
else
  echo "STEP_START: Installing Ollama"
  step_install_ollama || { echo "STEP_FAILED: Ollama install failed" >&2; exit 1; }
fi

if step_check_hotspot_tool; then
  echo "STEP_OK: linux-wifi-hotspot already installed"
else
  echo "STEP_START: Installing linux-wifi-hotspot"
  step_install_hotspot_tool || { echo "STEP_FAILED: linux-wifi-hotspot install failed" >&2; exit 1; }
fi

IFACE="$(step_detect_wifi_iface)"
if [ -z "$IFACE" ]; then
  echo "STEP_FAILED: no WiFi interface found" >&2
  exit 1
fi

echo "STEP_START: Writing hotspot config for interface $IFACE"
step_write_hotspot_config "$SSID" "$PASSWORD" "$IFACE" || { echo "STEP_FAILED: could not write /etc/create_ap.conf" >&2; exit 1; }

echo "STEP_OK: All system dependencies installed"
```

- [ ] **Step 2: Syntax-check it**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -n installer/lib/install-system-deps.sh && echo "install-system-deps.sh: syntax OK"
```

- [ ] **Step 3: Verify it end-to-end WITHOUT pkexec, running directly as the current user with dry-run on (safe: no real root elevation happens, and every dependency already resolves to "already installed" on this machine, so the one non-dry-run-guarded step - `step_write_hotspot_config`, which calls `sudo tee` - is also skipped by leaving `sudo` out of the picture entirely: verify it separately via dry-run explicitly)**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
VORLAN_DRY_RUN=1 bash installer/lib/install-system-deps.sh "VORLAN-testhost" "TestPass123!"
echo "exit code: $?"
```

Expected: `STEP_OK: Node.js/npm already installed`, `STEP_OK: Ollama already installed`, `STEP_OK: linux-wifi-hotspot already installed`, then (since `step_write_hotspot_config` checks `VORLAN_DRY_RUN` itself) a `[DRY RUN] write /etc/create_ap.conf:` block showing the config it *would* write with the given SSID/password, `STEP_OK: All system dependencies installed`, `exit code: 0` - proves the full privileged-script flow, argument handling, and every check/install branch work correctly end to end, without ever actually invoking `sudo`/`pkexec` or writing a real system file.

- [ ] **Step 4: Verify the missing-argument error path**

```bash
bash installer/lib/install-system-deps.sh 2>&1; echo "exit code: $?"
```

Expected: a `Usage: install-system-deps.sh <ssid> <password>` error and non-zero exit.

- [ ] **Step 5: Commit**

```bash
git add installer/lib/install-system-deps.sh
git commit -m "$(cat <<'EOF'
Add the installer's single privileged (pkexec) script

install-system-deps.sh runs every step needing root - Node/npm,
Ollama, linux-wifi-hotspot, and writing /etc/create_ap.conf - behind
one pkexec call instead of prompting for a password repeatedly.
Verified end-to-end via VORLAN_DRY_RUN (every dependency already
installed on this machine resolves to "already OK"; the one real
write, create_ap.conf, is confirmed via its own dry-run branch) rather
than actually invoking pkexec/sudo during this implementation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 6: Desktop entry and launcher templates

**Files:**
- Create: `installer/desktop/vorlan.desktop.template`
- Create: `installer/desktop/launch.sh.template`

**Interfaces:**
- Produces: two template files with `__INSTALL_DIR__` placeholders, filled in by Task 7's `install.sh` (via `sed`) and written to `~/.local/share/applications/vorlan.desktop` and `<install-dir>/launch.sh`.

- [ ] **Step 1: Write `installer/desktop/vorlan.desktop.template`**

```ini
[Desktop Entry]
Type=Application
Name=VORLAN
Comment=Smart home and network management
Exec=__INSTALL_DIR__/launch.sh
Icon=__INSTALL_DIR__/frontend/public/logo.jpeg
Terminal=false
Categories=Network;Utility;
```

- [ ] **Step 2: Write `installer/desktop/launch.sh.template`**

```bash
#!/usr/bin/env bash
# Generated by the VORLAN installer - starts the hotspot + backend, then opens
# VORLAN in the default browser. Everything stays running until reboot or a
# manual stop (no auto-stop when the browser tab closes - see the design spec).
set -e

INSTALL_DIR="__INSTALL_DIR__"
PORT="${PORT:-5000}"

# Start the hotspot (needs root - same mechanism as the manual pkexec create_ap
# command this replaces). Runs in the background; if it's already running,
# create_ap exits quickly on its own rather than erroring.
pkexec create_ap --config /etc/create_ap.conf >/tmp/vorlan-hotspot.log 2>&1 &

# Start the backend if it isn't already running.
if ! curl -s -o /dev/null "http://localhost:$PORT/api/system/connect-qr" 2>/dev/null; then
  (cd "$INSTALL_DIR/backend" && PORT="$PORT" node server.js >/tmp/vorlan-backend.log 2>&1 &)
fi

# Wait for the backend to come up, then open the browser.
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

xdg-open "http://localhost:$PORT/" >/dev/null 2>&1 &
```

- [ ] **Step 3: Syntax-check the launcher template and validate the desktop entry**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
mkdir -p installer/desktop
sed 's/__INSTALL_DIR__/\/tmp\/vorlan-test-install/' installer/desktop/launch.sh.template > /tmp/launch-test.sh
bash -n /tmp/launch-test.sh && echo "launch.sh template: syntax OK"

sed 's/__INSTALL_DIR__/\/tmp\/vorlan-test-install/' installer/desktop/vorlan.desktop.template > /tmp/vorlan-test.desktop
desktop-file-validate /tmp/vorlan-test.desktop && echo "vorlan.desktop template: valid"
rm -f /tmp/launch-test.sh /tmp/vorlan-test.desktop
```

Expected: both print their "OK"/"valid" line with no warnings from `desktop-file-validate`.

- [ ] **Step 4: Commit**

```bash
git add installer/desktop/vorlan.desktop.template installer/desktop/launch.sh.template
git commit -m "$(cat <<'EOF'
Add app-menu desktop entry and launcher script templates

vorlan.desktop.template + launch.sh.template, filled in by install.sh
with the real install path. The launcher starts the hotspot (via
pkexec create_ap) and the backend if not already running, waits for
it to respond, then opens the default browser - matching the design's
"opens in a browser tab, not a dedicated window" decision. Nothing is
stopped automatically when the browser tab closes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 7: `installer/install.sh` — the wizard entry point

**Files:**
- Create: `installer/install.sh`

**Interfaces:**
- Consumes: everything from Tasks 2-6 (`ui.sh`, `pkg.sh`, `steps.sh`, `install-system-deps.sh`, the desktop templates).
- Produces: the actual downloadable entry point users run.

- [ ] **Step 1: Write `installer/install.sh`**

```bash
#!/usr/bin/env bash
# VORLAN installer entry point. Run this file (chmod +x first) to install
# VORLAN and its dependencies on Fedora or Debian/Ubuntu.
#
# This file is published as a standalone download (a GitHub Release asset),
# so it can't assume its lib/ siblings are sitting next to it - if they're
# not found, it clones the repo to get them and re-execs itself from inside
# that clone, where they exist.
set -e

VORLAN_REPO_URL_BOOTSTRAP="https://github.com/dani4299/VORLAN.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SCRIPT_DIR/lib/pkg.sh" ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "git is required to run this installer (it fetches VORLAN's install scripts). Please install git and try again." >&2
    exit 1
  fi
  BOOTSTRAP_DIR="$(mktemp -d)"
  echo "Fetching installer files..." >&2
  git clone --quiet "$VORLAN_REPO_URL_BOOTSTRAP" "$BOOTSTRAP_DIR" >&2
  exec bash "$BOOTSTRAP_DIR/installer/install.sh" "$@"
fi

source "$SCRIPT_DIR/lib/pkg.sh"
source "$SCRIPT_DIR/lib/ui.sh"
source "$SCRIPT_DIR/lib/steps.sh"

INSTALL_DIR="$HOME/.local/share/VORLAN"
LOG_FILE="$INSTALL_DIR/install.log"

fail() {
  local msg="$1"
  ui_error "VORLAN Installer" "$msg
See $LOG_FILE for details."
  exit 1
}

mkdir -p "$INSTALL_DIR"
: > "$LOG_FILE"

if ! pkg_detect; then
  ui_detect_backend || { echo "No dialog tool available and none could be installed." >&2; exit 1; }
  ui_error "VORLAN Installer" "This installer supports Fedora (dnf) and Debian/Ubuntu (apt) only. Neither was found on this system."
  exit 1
fi

ui_detect_backend || fail "Could not find or install a dialog tool (zenity/kdialog/whiptail)."

ui_message "Welcome to VORLAN" "This installs VORLAN and everything it needs: Node.js, Ollama (with the phi3 model), and linux-wifi-hotspot for phone/tablet access via a WiFi hotspot.

Click OK to continue."

DEFAULT_SSID="VORLAN-$(hostname)"
DEFAULT_PASSWORD="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 12)"

SSID="$(ui_input "WiFi Network Name" "Choose the WiFi network name your phone/tablet will connect to:" "$DEFAULT_SSID")" || fail "Installation cancelled."
PASSWORD="$(ui_password "WiFi Password" "Choose the WiFi password (leave as-is to use the generated one shown):" )" 
if [ -z "$PASSWORD" ]; then PASSWORD="$DEFAULT_PASSWORD"; fi

ui_confirm "Ready to Install" "VORLAN will now install Node.js, Ollama + the phi3 model, linux-wifi-hotspot, and VORLAN itself.

WiFi network name: $SSID

This may take several minutes and will ask for your password once. Continue?" || fail "Installation cancelled."

ui_progress_start "Installing VORLAN"

ui_progress_update 10 "Installing system dependencies (Node.js, Ollama, linux-wifi-hotspot)..."
PKEXEC_LOG="$INSTALL_DIR/pkexec-system-deps.log"
if ! pkexec bash "$SCRIPT_DIR/lib/install-system-deps.sh" "$SSID" "$PASSWORD" >> "$LOG_FILE" 2>&1; then
  ui_progress_done
  fail "Installing system dependencies failed."
fi

ui_progress_update 60 "Downloading the AI model (phi3) - this may take a while..."
if step_check_model phi3; then
  echo "phi3 already pulled" >> "$LOG_FILE"
else
  step_pull_model phi3 >> "$LOG_FILE" 2>&1 || { ui_progress_done; fail "Downloading the phi3 model failed."; }
fi

ui_progress_update 75 "Downloading VORLAN..."
step_clone_or_update_vorlan "$INSTALL_DIR" >> "$LOG_FILE" 2>&1 || { ui_progress_done; fail "Downloading VORLAN failed."; }

ui_progress_update 85 "Building VORLAN..."
step_build_vorlan "$INSTALL_DIR" >> "$LOG_FILE" 2>&1 || { ui_progress_done; fail "Building VORLAN failed."; }

ui_progress_update 95 "Adding VORLAN to your application menu..."
mkdir -p "$HOME/.local/share/applications"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$SCRIPT_DIR/desktop/launch.sh.template" > "$INSTALL_DIR/launch.sh"
chmod +x "$INSTALL_DIR/launch.sh"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$SCRIPT_DIR/desktop/vorlan.desktop.template" > "$HOME/.local/share/applications/vorlan.desktop"

ui_progress_update 100 "Done!"
ui_progress_done

if ui_confirm "VORLAN Installed" "VORLAN is installed and added to your application menu.

WiFi network name: $SSID
WiFi password: $PASSWORD
(keep these - you'll need them to connect a phone/tablet)

Open VORLAN now?"; then
  "$INSTALL_DIR/launch.sh" &
fi
```

- [ ] **Step 2: Syntax-check it**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
bash -n installer/install.sh && echo "install.sh: syntax OK"
```

- [ ] **Step 3: Dry-run the full wizard end-to-end using whiptail (scriptable, non-interactive, safe - real dependency checks all resolve to "already OK" on this machine, so no real install command fires; the pkexec call itself is the one thing this step must avoid triggering for real, handled below)**

`install.sh` calls `pkexec bash install-system-deps.sh` directly - not dry-run-gated at that call site, since `pkexec` itself would prompt for a real password. Verify the wizard's flow up to that point, and verify `install-system-deps.sh` separately (already done in Task 5). Temporarily point `install.sh` at a harmless stand-in for this one verification run:

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
export VORLAN_DRY_RUN=1
rm -rf /tmp/vorlan-installtest-home
mkdir -p /tmp/vorlan-installtest-home
HOME=/tmp/vorlan-installtest-home bash -c '
  # Stand in for pkexec: run install-system-deps.sh directly as the current user
  # (dry-run mode makes every step safe) instead of actually elevating.
  pkexec() { shift; bash "$@"; }
  export -f pkexec
  bash installer/install.sh <<EOF
EOF
' 2> /tmp/installtest-stderr.log
echo "exit: $?"
cat /tmp/vorlan-installtest-home/.local/share/VORLAN/install.log 2>/dev/null | tail -20
ls /tmp/vorlan-installtest-home/.local/share/applications/vorlan.desktop && echo "desktop entry written"
ls /tmp/vorlan-installtest-home/.local/share/VORLAN/launch.sh && echo "launcher written"
rm -rf /tmp/vorlan-installtest-home
```

Note: `whiptail` dialogs read from the real terminal (not stdin redirection) for interactive input in some modes; if any prompt blocks waiting for real input during this test, note it in the log and press through manually once to confirm the flow, then re-run non-interactively for the record - this is expected friction for a GUI-oriented tool being verified from a script, not a bug in `install.sh` itself.

Expected: the script reaches the end without a fatal error, `install.log` shows each step's `STEP_OK`/`STEP_START` lines from `install-system-deps.sh` plus the phi3/clone/build steps, and both the desktop entry and launcher script get written to the test `HOME`.

- [ ] **Step 4: Verify the standalone-bootstrap path (this is the actual real-world path once `install.sh` is published as a standalone downloadable file - Task 9)**

Copy *only* `install.sh` (no `lib/`/`desktop/` siblings) to an empty directory and confirm it detects the missing siblings, clones the repo, and re-execs from the clone:

```bash
rm -rf /tmp/vorlan-bootstrap-test
mkdir -p /tmp/vorlan-bootstrap-test
cp /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master/installer/install.sh /tmp/vorlan-bootstrap-test/
bash -n /tmp/vorlan-bootstrap-test/install.sh && echo "standalone copy: syntax OK"
timeout 20 bash -c '
  cat <<EOF | bash /tmp/vorlan-bootstrap-test/install.sh 2>&1 | head -5
EOF
' || true
```

Expected: stderr shows `Fetching installer files...` followed by output from the re-exec'd copy running inside the freshly-cloned repo (e.g. it proceeds to `ui_detect_backend`'s output) - confirms the bootstrap correctly detects the missing siblings and successfully re-launches itself from a full clone. (The `timeout 20`/piped-empty-stdin here is just to keep this one verification non-interactive and bounded, since the real wizard would otherwise wait on a dialog; Step 3 already covers the full interactive flow.)

```bash
rm -rf /tmp/vorlan-bootstrap-test
```

- [ ] **Step 5: Commit**

```bash
git add installer/install.sh
git commit -m "$(cat <<'EOF'
Add installer entry point (install.sh)

Wires ui.sh, pkg.sh, steps.sh, install-system-deps.sh, and the desktop
templates into the full wizard: welcome -> WiFi network name/password
(pre-filled, editable) -> confirm -> one progress dialog through every
install step -> done screen showing the WiFi credentials again, with
an option to open VORLAN immediately. Any step failure shows which
step failed via ui_error and points at install.log rather than
failing silently.

Self-bootstraps when run as a standalone file with no lib/ siblings
(the actual shape it's downloaded in once published as a GitHub
Release asset in the next commit) - clones the repo and re-execs
itself from inside that clone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 8: `installer/README.md`

**Files:**
- Create: `installer/README.md`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Write `installer/README.md`**

```markdown
# VORLAN Linux Installer

A single-file installer for Fedora and Debian/Ubuntu that installs
Node.js/npm, Ollama + the `phi3` model, [linux-wifi-hotspot](https://github.com/lakinduakash/linux-wifi-hotspot),
and VORLAN itself, then adds VORLAN to your application menu.

## Running it

```bash
chmod +x install.sh
./install.sh
```

(Or double-click `install.sh` in a file manager that supports running scripts
directly - not every file manager does by default, so the terminal command
above is the reliable path.)

You'll be asked to pick a WiFi network name and password for the hotspot
your phone/tablet will connect to, then asked for your password once (via a
graphical `pkexec` prompt) to install system packages.

## Supported systems

- Fedora (`dnf`)
- Debian/Ubuntu (`apt`)

Anything else exits immediately with a clear message before downloading
anything.

## Re-running

The installer is idempotent: re-running it detects anything already
installed (Node, Ollama, the `phi3` model, linux-wifi-hotspot) and skips
reinstalling it, and updates an existing VORLAN checkout in place (`git
pull`) rather than re-cloning.

## What gets installed where

- VORLAN itself: `~/.local/share/VORLAN`
- Application menu entry: `~/.local/share/applications/vorlan.desktop`
- Hotspot config: `/etc/create_ap.conf`
- Install log: `~/.local/share/VORLAN/install.log`

## Testing locally without installing anything for real

Every script under `lib/` respects `VORLAN_DRY_RUN=1`, which makes every
package-install/build command print what it *would* run instead of running
it:

```bash
VORLAN_DRY_RUN=1 bash lib/install-system-deps.sh "VORLAN-test" "somepassword"
```

## Known limitations

- No uninstaller yet.
- The hotspot and VORLAN's backend keep running until you reboot or stop
  them manually - closing VORLAN's browser tab doesn't stop them (same as
  how Ollama's own background service already behaves).
- Hotspot/systemd behavior can only be fully verified on real hardware, not
  in a container - the Debian/Ubuntu package-manager path is verified via
  dry-run + code review against `linux-wifi-hotspot`'s own documented
  dependencies, not a full container run.
```

- [ ] **Step 2: Commit**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
git add installer/README.md
git commit -m "$(cat <<'EOF'
Add installer README

Documents how to run the installer, supported distros, where it
installs things, how re-running it behaves, how to exercise it via
VORLAN_DRY_RUN without touching real system state, and its current
known limitations.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
```

---

### Task 9: One-click download - GitHub Release asset + repo README link

**Why a Release, not a plain repo link:** GitHub serves a raw file link (`raw.githubusercontent.com/...`) with `Content-Disposition: inline` for a `.sh` file - clicking it typically opens the script as text in the browser tab instead of downloading it. A GitHub Release asset is served with `Content-Disposition: attachment`, which reliably triggers a real browser download - what the user asked for ("click HERE, a download should start"). `releases/latest/download/<filename>` is a stable URL that always resolves to the newest release's matching asset, so the README link never needs updating on future releases.

**Files:**
- Modify: `README.md` (repo root)

**Interfaces:** None (documentation + a published GitHub Release artifact, not code other tasks depend on).

**⚠️ This task publishes something publicly visible on the GitHub repo (a Release, separate from and more visible than an ordinary commit/push - it notifies watchers and gets its own page). Confirm with the user before running the `gh release create` step specifically**, even though commits/pushes to this repo have already been repeatedly authorized in this conversation - a Release is a distinct kind of public action this plan hasn't had explicit sign-off for yet.

- [ ] **Step 1: Make `install.sh` executable and verify it one more time from a clean checkout**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
chmod +x installer/install.sh
git update-index --chmod=+x installer/install.sh
bash -n installer/install.sh && echo "final syntax check: OK"
```

- [ ] **Step 2: Commit the executable bit**

```bash
git add installer/install.sh
git commit -m "$(cat <<'EOF'
Mark installer/install.sh executable

Needed so a downloaded copy can be run directly (./install.sh) without
an extra chmod step being strictly required for the git-tracked copy,
and so the file mode is correct in the Release asset uploaded next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
git push origin main
```

- [ ] **Step 3: STOP - confirm with the user before publishing the Release**

Ask: "Ready to publish `installer/install.sh` as a GitHub Release asset (tag e.g. `installer-v1.0.0`) so the README's download link works? This creates a public Release on the repo." Proceed to Step 4 only after an explicit yes.

- [ ] **Step 4: Create the Release with `install.sh` attached (only after Step 3's confirmation)**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
cp installer/install.sh /tmp/VORLAN-Install-Linux.sh
gh release create installer-v1.0.0 /tmp/VORLAN-Install-Linux.sh \
  --title "VORLAN Linux Installer v1.0.0" \
  --notes "One-click installer for Fedora and Debian/Ubuntu. Installs Node.js, Ollama + phi3, linux-wifi-hotspot, and VORLAN itself, and adds VORLAN to your application menu.

Run: chmod +x VORLAN-Install-Linux.sh && ./VORLAN-Install-Linux.sh"
rm -f /tmp/VORLAN-Install-Linux.sh
```

- [ ] **Step 5: Verify the download URL actually works and forces a download**

```bash
curl -sI "https://github.com/dani4299/VORLAN/releases/latest/download/VORLAN-Install-Linux.sh" | grep -i "content-disposition\|location\|HTTP"
```

Expected: a redirect chain ending in a response with `content-disposition: attachment; filename=VORLAN-Install-Linux.sh` (or equivalent) - confirms this URL genuinely triggers a browser download rather than displaying the file inline.

- [ ] **Step 6: Add the download section to the repo's root `README.md`**

Add this section near the top of `README.md`, right after the project's existing title/intro and before the "Getting Started" developer-setup section that's already there:

```markdown
## Install on Linux

Download the installer for Fedora, Ubuntu, or Debian [**HERE**](https://github.com/dani4299/VORLAN/releases/latest/download/VORLAN-Install-Linux.sh), then run it:

    chmod +x VORLAN-Install-Linux.sh
    ./VORLAN-Install-Linux.sh

The installer sets up everything VORLAN needs - Node.js, Ollama (with the
`phi3` model), and [linux-wifi-hotspot](https://github.com/lakinduakash/linux-wifi-hotspot)
for phone/tablet access - and adds VORLAN to your application menu. See
[`installer/README.md`](installer/README.md) for details, supported
systems, and troubleshooting.
```

- [ ] **Step 7: Commit and push the README change**

```bash
cd /home/dani4299/Downloads/VORLAN-Master-20260816T113344Z-1-001/VORLAN-Master
git add README.md
git commit -m "$(cat <<'EOF'
Add Linux installer download link to the README

Points at the GitHub Release asset (not a raw file link, which
typically displays as text instead of downloading) so clicking it
actually starts a browser download, per the one-click install
workflow this project now supports.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MrrYuuX77EZGVXQbC3mVTb
EOF
)"
git push origin main
```
