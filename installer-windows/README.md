# VORLAN Windows Installer

A PowerShell installer that installs Node.js and Ollama + the `phi3` model via
[winget](https://learn.microsoft.com/windows/package-manager/winget/), fetches VORLAN itself,
builds it, and adds a desktop shortcut and a Start Menu entry. The Windows counterpart of
[`installer/`](../installer), which does the same job on Linux.

## Running it

```powershell
powershell -ExecutionPolicy Bypass -File installer-windows\install.ps1
```

(Or right-click `install.ps1` and choose **Run with PowerShell** - Windows blocks running
downloaded scripts by default, which is what `-ExecutionPolicy Bypass` works around for this one
run; it doesn't change your system's default policy.)

By default VORLAN is installed to `%LOCALAPPDATA%\VORLAN` (no administrator rights needed for
VORLAN itself - only whichever of its dependencies winget decides needs elevation, the same as
installing them by hand would). Pass `-InstallDir` to use a different folder:

```powershell
powershell -ExecutionPolicy Bypass -File installer-windows\install.ps1 -InstallDir "D:\Apps\VORLAN"
```

## Requirements

- Windows 10 (1809+) or Windows 11, with `winget` available (it ships with these by default; if
  it's missing, install **App Installer** from the Microsoft Store and re-run this script).
- An internet connection, to fetch VORLAN and its dependencies.

## Re-running

The installer is idempotent: re-running it detects anything already installed (Git, Node.js,
Ollama, the `phi3` model) and skips reinstalling it, and updates an existing VORLAN checkout in
place (`git pull`) rather than re-cloning.

## What gets installed where

- VORLAN itself: `%LOCALAPPDATA%\VORLAN` (or wherever `-InstallDir` pointed)
- Desktop shortcut: `%USERPROFILE%\Desktop\VORLAN.lnk`
- Start Menu entry: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\VORLAN\VORLAN.lnk`
- Sign-in key and HTTPS certificate (generated on first start, private to your user): `%LOCALAPPDATA%\VORLAN\backend\secrets`

Both shortcuts point at a small VBScript (`launch.vbs`, next to `launch.ps1` inside the install
folder) rather than the PowerShell script directly, so opening VORLAN never flashes a console
window - it should feel like opening any other installed app.

## What the shortcut actually does

Unlike the Linux installer, this one does **not** set up a background service - there's no
Windows equivalent of the systemd unit `installer/` writes on Linux in this installer. VORLAN only
runs while something has started it: opening the shortcut checks whether the backend is already
answering on `http://localhost:5000`, starts it (hidden, no console window) if it isn't, waits for
it to come up, then opens your browser to it. Closing the browser tab does not stop VORLAN; if you
want it to actually stop, close the hidden `node.exe` process from Task Manager, or sign out/restart
your PC.

## Ollama and the AI Assistant

If the Ollama or `phi3` steps fail (a slow connection, a very large model download interrupted),
VORLAN still installs and runs - the Assistant just won't have a model to talk to until you run
`ollama pull phi3` yourself. Everything else works normally either way.

## HTTPS

VORLAN serves itself over HTTPS on port `5443` with a certificate it creates for itself on first
start; opening it from the desktop shortcut keeps using `http://localhost:5000` on this same
computer (no certificate warning). A phone or another device on your network reaching this PC's
LAN address instead sees the HTTPS version and a one-time browser warning about the certificate -
compare the fingerprint it shows with the one in **Support ▸ Security** before accepting.

## Known limitations

- No uninstaller yet. To remove VORLAN: delete the install folder, the desktop shortcut, and the
  Start Menu folder listed above.
- No SMB/NFS sharing on Windows. That's an existing, deliberate limitation of VORLAN itself (see
  the top-level README's Roadmap) - `Storage Manager`'s sharing toggles report themselves as
  unavailable on any non-Linux install, this one included, rather than pretending to work.
- No background service / auto-start-at-boot - see "What the shortcut actually does" above.
- Verified by running each step for real on a real Windows 11 machine during development.
