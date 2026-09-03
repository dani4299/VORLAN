# Linux installer — design

## Context

VORLAN currently requires a developer-style manual setup: clone the repo,
install Node/npm yourself, install and configure Ollama yourself, run
`npm start`, and — if you want a phone to reach it via a hotspot — set one up
by hand (as the user did manually with `create_ap` from
[linux-wifi-hotspot](https://github.com/lakinduakash/linux-wifi-hotspot)).

This spec covers a one-file downloadable installer for Linux desktops that
installs every dependency VORLAN needs (Node.js/npm, Ollama + the `phi3`
model, linux-wifi-hotspot), installs VORLAN itself, wires up the hotspot to
start automatically whenever VORLAN is launched, and adds a "VORLAN" entry to
the user's application menu.

## Goals

- A single downloadable script that, when run, shows a graphical
  welcome → configure → progress → done wizard — no terminal knowledge
  required beyond making the file executable.
- Works on "almost every" Linux desktop, not just one distro/desktop
  environment — achieved by auto-detecting whichever dialog tool is actually
  present (zenity, kdialog, or a guaranteed-available whiptail fallback),
  not by assuming one specific GUI toolkit.
- Installs: Node.js + npm, Ollama (with its own boot-time systemd service),
  the `phi3` model, linux-wifi-hotspot (built from source against either
  distro's dependencies), and VORLAN itself.
- Adds VORLAN to the application menu (a standard `.desktop` entry). Opening
  it starts the hotspot + VORLAN's server, then opens VORLAN in the user's
  default browser — no dedicated app window.
- The hotspot's WiFi network name and password are configurable during
  install (labeled "WiFi network name," not "SSID" — most people don't know
  that term), pre-filled with sensible auto-generated defaults.
- Once started, the hotspot and VORLAN's server keep running until reboot
  or a manual stop — no "quit" action is built.
- **The existing QR "Connect a device" flow (phones/tablets scanning to
  reach VORLAN) must keep working exactly as before** — this is the one
  existing feature the installer's changes could realistically break, since
  it depends on which port/process is actually serving the frontend.

## Non-goals

- No distros beyond Fedora (`dnf`) and Debian/Ubuntu (`apt`). Anything else
  fails immediately with a clear message, before downloading anything.
- No Electron / dedicated app window — confirmed twice now as deferred
  (this spec and the earlier QR-onboarding spec both explicitly set it
  aside). Opening VORLAN opens the default browser.
- No uninstaller in this version. A clear, well-scoped follow-up, not part
  of this pass.
- No auto-stop of the hotspot/server when VORLAN's browser tab is closed —
  closing a tab can't reliably signal that to a launcher script anyway, and
  Ollama already behaves the same way (always-on background service).
- No changes to the in-app "Connect Device" QR modal's own code — it
  keeps working unmodified. What *does* need to change is what URL/port the
  backend hands it, covered below.
- No changes to windows support - Linux only, matching every other
  networking-adjacent spec in this project so far.

## Architecture

### Why a shell script, not Electron/Python/etc.

Node.js and npm don't exist on the machine yet when the installer first
runs — the installer's job is partly to install them. A Node-based (or
Electron-based) installer UI is a chicken-and-egg problem for that first
bootstrap step. A shell script has no such dependency: bash is present on
every target distro by definition (it's what the distro's own package
manager scripts run on).

### `installer/lib/ui.sh` — dialog-backend abstraction

Detects and wraps whichever GUI dialog tool is actually present, so the
rest of the installer only ever calls backend-agnostic functions:

- **Detection order**: `zenity` (GNOME/most desktops) → `kdialog` (KDE) →
  `whiptail` (terminal-based `dialog`-style UI; if entirely absent, it's
  installed on the spot via `pkg.sh` — it's a tiny package present in every
  major distro's base repos, so this is the guaranteed-to-work floor).
- **Functions**: `ui_message`, `ui_input`, `ui_password`, `ui_confirm`,
  `ui_progress_start` / `ui_progress_update` / `ui_progress_done`,
  `ui_error`. Each dispatches to the detected backend's equivalent flag
  syntax (e.g. `zenity --progress` vs `kdialog --progressbar` vs
  `whiptail --gauge`).

### `installer/lib/pkg.sh` — package-manager abstraction

Detects `dnf` vs `apt` via `command -v`; anything else exits immediately
with `ui_error` before any download starts. Exposes `pkg_install <names...>`
mapping to the right package list per manager. The two dependency lists
needed for linux-wifi-hotspot are already confirmed from its own docs:

- Debian/Ubuntu: `libgtk-3-dev build-essential gcc g++ pkg-config make
  hostapd libqrencode-dev libpng-dev`
- Fedora: `gtk3-devel gcc gcc-c++ kernel-devel pkg-config make hostapd
  qrencode-devel libpng-devel`

### `installer/lib/install-system-deps.sh` — the one privileged step

Everything needing root (package installs, linux-wifi-hotspot's
`make install`, writing `/etc/create_ap.conf`) lives in one script, run once
via a single `pkexec` call — one graphical password prompt total, using the
same mechanism the user already used manually for `create_ap`, rather than
prompting repeatedly across several steps.

### `installer/install.sh` — the wizard flow

Entry point; downloaded/run directly by the user (`chmod +x` then run, or
double-click if the file manager supports script execution — a real,
disclosed limitation of a plain shell script: there's no single mechanism
that's double-click-runnable on every Linux file manager without extra
packaging). Screens, in order:

1. **Welcome** — what VORLAN is, Next/Cancel.
2. **WiFi network name / password** — `ui_input`/`ui_password`, pre-filled
   with `VORLAN-<hostname>` and a random 12-character password (same
   generation shape as the existing unused `hotspot.service.js`), editable.
3. **Summary** — lists what will be installed, Next to begin.
4. **Progress** — one continuously-updating dialog stepping through:
   detect distro → install Node/npm → install Ollama (official install
   script, which sets up its own boot-time systemd service) → `ollama pull
   phi3` → install linux-wifi-hotspot's build deps, clone it, `make && sudo
   make install`, write `/etc/create_ap.conf` with the chosen name/password
   → clone/update `dani4299/VORLAN` into `~/.local/share/VORLAN` → `npm
   install` (root, backend, frontend) → `npm run build` (frontend
   production bundle) → write the launcher script + `.desktop` entry.
   `ollama pull phi3`'s progress is shown as indeterminate status text
   ("Downloading the AI model, this may take a while") rather than an exact
   percentage — parsing Ollama's own pull-progress format for a precise
   number isn't worth the added complexity here.
5. **Done** — shows the WiFi network name/password again for reference, an
   "Open VORLAN now" action, and a Close action.
6. **Any step failure** aborts immediately via `ui_error` naming the failed
   step, with full output captured to `~/.local/share/VORLAN/install.log`
   for troubleshooting — never a silent partial install.

The hotspot's `create_ap` service is deliberately **not** enabled at boot
(`systemctl enable create_ap` is skipped) — it starts on demand from
VORLAN's own launcher instead, matching "when I open VORLAN" rather than
"on every boot" (the same distinction the user drew explicitly between the
hotspot and Ollama).

### Launcher (`~/.local/share/VORLAN/launch.sh`) and app menu entry

- Starts `create_ap` (via `pkexec`, since it needs root) in the background.
- Starts the backend (`node server.js`) if not already running.
- Waits for the backend to respond, then `xdg-open`s the default browser to
  the dashboard.
- `~/.local/share/applications/vorlan.desktop` — standard XDG entry
  (`Name=VORLAN`, `Exec=<install-dir>/launch.sh`, `Icon=<install-dir's
  logo>`, `Categories=Network;`), matching the convention already visible
  in this machine's own `~/.local/share/applications/`.

### Keeping the QR/mobile flow working (the one existing feature at risk)

Today, `backend/src/routes/system.routes.js`'s `connect-qr` endpoint always
points the QR/URL at port `5173` — the Vite **dev server**, which won't
exist at all in an installed setup (the installer builds a static
production bundle instead; running a permanent dev server for an end user
isn't appropriate). Left unchanged, every phone/tablet scan would break the
moment VORLAN is installed rather than run from a dev checkout.

Two coordinated changes fix this:

1. **`backend/server.js`**: when `frontend/dist/index.html` exists (a
   production build is present), serve it — `express.static` for the built
   assets, plus a catch-all SPA fallback to `index.html` for any
   non-`/api`, non-`/media` route. This is required because the frontend
   uses `BrowserRouter` (confirmed in `frontend/src/main.jsx`), so a phone
   opening a deep link like `/dashboard/ai` directly needs the server to
   still return the app shell, not a 404. When no build is present (normal
   local dev), this block is simply skipped — `npm start`'s existing
   Vite-dev-server workflow is completely unaffected.
2. **`connect-qr`**: instead of a hardcoded `5173`, it checks the same
   "does a production build exist" condition. If yes, the QR/URL points at
   the backend's own port (`PORT`, default `5000`) — the same process now
   serves both the API and the frontend, so there's only one port to reach.
   If no (dev mode), behavior is unchanged: it still points at `5173`.

This keeps the QR flow correct in both states (dev checkout being worked on
by a developer, and an end-user's installed copy) without touching the
frontend `ConnectDeviceModal`/`ConnectDeviceButton` code at all.

## File layout

```
installer/
  install.sh                    # entry point - wizard flow
  lib/
    ui.sh                       # zenity/kdialog/whiptail abstraction
    pkg.sh                      # dnf/apt abstraction
    steps.sh                    # unprivileged install steps + orchestration
    install-system-deps.sh      # the one pkexec-elevated script
  desktop/
    vorlan.desktop.template     # filled in with the real install path
    launch.sh.template
  README.md                     # supported distros, how to test locally
```

## Data flow

```
User runs install.sh
        |
        v
ui.sh detects zenity/kdialog/whiptail
        |
        v
Welcome -> WiFi name/password (editable) -> Summary -> Next
        |
        v
pkg.sh detects dnf/apt (unsupported -> ui_error, stop)
        |
        v
pkexec install-system-deps.sh (node/npm, ollama, phi3 pull,
        linux-wifi-hotspot build+install, write create_ap.conf)
        |
        v
steps.sh (unprivileged): clone/update VORLAN, npm install, npm run build
        |
        v
write launch.sh + vorlan.desktop
        |
        v
Done screen (shows WiFi name/password) -> [Open VORLAN now]
        |
        v
launch.sh: pkexec create_ap (background) -> start backend -> xdg-open browser
        |
        v
Backend serves frontend/dist + API from one port; connect-qr now points
phones/tablets at that same port -> QR flow keeps working
```

## Error handling

- Unsupported package manager: fails at the very first check, before any
  network activity.
- Any install step failure: wizard shows which step failed via `ui_error`,
  points at `~/.local/share/VORLAN/install.log` for the full output, and
  stops — no silent partial install.
- Re-running the installer is idempotent: Node/Ollama/linux-wifi-hotspot
  already present are detected and skipped rather than reinstalled; the
  VORLAN checkout is `git pull`ed in place rather than re-cloned.
- `pkexec` cancelled/denied: wizard reports it plainly and stops (no retry
  loop) — same behavior as `hotspot.service.js`'s existing "no silent
  failure" convention for `nmcli` errors.

## Testing plan

- **Fedora (this machine)**: the only environment where the full install
  can be run for real — actual package installs, actual `create_ap`,
  actual `ollama pull phi3`, actual launcher + `.desktop` entry, actual
  phone/tablet scan of the resulting QR code against the installed build.
- **Debian/Ubuntu**: verified via a container for `pkg.sh`'s
  detection/mapping logic and the non-networking install steps only —
  **hotspot/systemd behavior cannot be verified inside a typical container**
  (no real WiFi hardware, often no full systemd), same disclosed limitation
  pattern as the original hotspot spec's "cannot verify a phone actually
  scanning" note.
- **Mobile/tablet regression check (explicit acceptance criterion)**: after
  building the production bundle and running the backend with it present,
  confirm `connect-qr` returns the backend's own port (not `5173`); confirm
  that URL serves the app shell; confirm a *direct* request to a deep
  client-side route (e.g. `/dashboard/ai`) also returns the app shell
  (proves the SPA fallback works, not just `/`) rather than a 404; confirm
  the existing dev workflow (`npm start`, no build present) is completely
  unaffected — `connect-qr` still returns `5173` and the backend serves no
  static frontend content.
- **Idempotency**: running `install.sh` a second time completes quickly and
  without error, making no redundant changes.

## Open follow-ups (explicitly out of scope here)

- Uninstaller.
- Distros beyond Fedora/Debian/Ubuntu.
- Electron/dedicated app window.
- A real "stop/quit" action for the hotspot and server.
