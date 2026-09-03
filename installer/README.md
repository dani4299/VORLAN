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
