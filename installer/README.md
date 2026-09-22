# VORLAN Linux Installer

A single-file installer for Fedora and Debian/Ubuntu that installs
Node.js/npm, Ollama + the `phi3` model, Docker (for VORLAN's App Store),
Samba and NFS (for SMB/NFS sharing),
[linux-wifi-hotspot](https://github.com/lakinduakash/linux-wifi-hotspot),
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
installed (Node, Ollama, the `phi3` model, Docker, Samba, NFS,
linux-wifi-hotspot) and skips reinstalling it, and updates an existing
VORLAN checkout in place (`git pull`) rather than re-cloning.

## What gets installed where

- VORLAN itself: `~/.local/share/VORLAN`
- Application menu entry: `~/.local/share/applications/vorlan.desktop`
- Background service: `~/.config/systemd/user/vorlan.service`
- SMB/NFS sharing: `/etc/samba/vorlan-shares.conf`, `/etc/exports.d/vorlan.exports`, `/etc/sudoers.d/vorlan-sharing`
- Sign-in key and HTTPS certificate (generated on first start, private to your user): `~/.local/share/VORLAN/backend/secrets`
- Hotspot config: `/etc/create_ap.conf`
- Install log: `~/.local/share/VORLAN/install.log`

## Testing locally without installing anything for real

Every script under `lib/` respects `VORLAN_DRY_RUN=1`, which makes every
package-install/build command print what it *would* run instead of running
it:

```bash
VORLAN_DRY_RUN=1 bash lib/install-system-deps.sh "VORLAN-test" "somepassword" "$(whoami)"
```

## App Store (Docker)

VORLAN's App Store installs other self-hosted apps (Nextcloud, Pi-hole, a
Minecraft server, or any Docker image you point it at) as containers. This
installer sets Docker up for you automatically: skipped entirely if it's
already installed, installed via Docker's own official script otherwise, and
your account is added to the `docker` group so VORLAN (which runs as you, not
root) can use it without `sudo`. That group membership only applies from your
*next* sign-in - if this is the first time Docker was set up on this machine,
sign out and back in (or restart) before opening the App Store, or it will
report Docker as unavailable even though it's installed.

## SMB/NFS sharing

Turn any of the five shareable datasets into a network share from
**Storage Manager**, in the admin desktop - Personal vaults stays out of
reach, since sharing has no way to enforce its owner's own PIN. This
installer sets Samba and NFS up for you automatically (skipped if already
installed), and grants your account a narrow, passwordless `sudo` rule
(`/etc/sudoers.d/vorlan-sharing`) covering only the exact commands VORLAN's
backend needs at runtime to manage shares - adding/removing a Samba account
and reloading Samba/NFS's config. VORLAN itself still runs as you, never as
root; nothing broader than those specific commands is granted, and the rule
is validated with `visudo -c` before it's ever installed.

- **SMB** shares use real per-account Samba logins, created and kept in
  sync with your VORLAN password every time you sign up, change your
  password, or an administrator resets one - so the same login that gets
  you into VORLAN's own UI also gets you into `\\<this computer>\<share>`
  from Windows or Mac. Renaming a VORLAN account removes its Samba login
  (Samba has no rename of its own); it comes back automatically the next
  time that account's password is set.
- **NFS** has no sign-in step of its own - an NFS export is reachable by
  any device on the local network, not gated by a VORLAN account. That
  trade-off is stated directly in the sharing toggle itself, not hidden.
- Both protocols write files as the account VORLAN itself runs as (the
  same one that already owns `secure_vault`), so permissions stay
  consistent whichever way a file arrived.

## Background service

VORLAN runs as a `systemd --user` service - started the moment install finishes,
and again automatically every time this computer starts, whether or not you
ever sign in to the desktop (the installer runs `loginctl enable-linger` for
your account so that works). It restarts on its own if it ever crashes.

```bash
systemctl --user status vorlan     # is it running, since when, how many restarts
systemctl --user restart vorlan
systemctl --user stop vorlan       # stays stopped until started again or the next restart
journalctl --user -u vorlan -f     # follow its logs live
```

The same restart/stop controls are in the admin desktop's **Services** window,
next to the VORLAN API entry - handy when you're already signed in and don't
want a terminal.

The application menu shortcut no longer starts VORLAN itself (the service
already has); it just opens a browser to it, and starts the service if it
somehow isn't running yet.

## HTTPS

VORLAN serves itself over HTTPS on port `5443` with a certificate it creates for
itself on first start. Opening VORLAN from the application menu keeps using
`http://localhost:5000` on the same computer (no warning); the phone or tablet
connecting through the hotspot uses `https://<this computer's address>:5443`
and sees a one-time browser warning about the certificate - the QR code in
the app already points at the right address. Compare the fingerprint the
warning shows with the one in **Support ▸ Security** before accepting. Delete
`backend/secrets` to start over with a new certificate and sign-in key (everyone
signs in again).

## Known limitations

- No uninstaller yet. (To stop VORLAN's service running at boot without
  uninstalling anything: `systemctl --user disable --now vorlan`.)
- The hotspot keeps running until you reboot or stop it manually - closing
  VORLAN's browser tab doesn't stop it (same as how Ollama's own background
  service already behaves). VORLAN itself is meant to keep running - see
  "Background service" above for how to actually stop it if you want to.
- The systemd service step is verified the same way as the Docker and
  hotspot steps (dry-run + code review against systemd's own documented
  behavior) - it hasn't been run against a real Fedora or Debian/Ubuntu
  machine yet.
- The SMB/NFS sharing steps (Samba/NFS install, the sudoers rule, the
  smb.conf/exports wiring) are verified the same way - dry-run + code
  review, plus every backend/frontend code path exercised for real on this
  Windows dev machine via the "sharing isn't available here" branch (the
  genuine result on Windows). The actual Samba/NFS daemons, a real
  `sudo smbpasswd`/`exportfs` call, and a real phone or PC actually
  mounting a share have not been run against a real Fedora or
  Debian/Ubuntu machine yet.
- Hotspot/systemd behavior can only be fully verified on real hardware, not
  in a container - the Debian/Ubuntu package-manager path is verified via
  dry-run + code review against `linux-wifi-hotspot`'s own documented
  dependencies, not a full container run.
- The Docker setup step is verified the same way (dry-run + code review
  against Docker's own documented install script and group-membership
  behavior) - it hasn't been run against a real Fedora or Debian/Ubuntu
  machine yet.
