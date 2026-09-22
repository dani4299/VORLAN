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

ui_message "Welcome to VORLAN" "This installs VORLAN and everything it needs: Node.js, Ollama (with the phi3 model), Samba/NFS (for network shares), and linux-wifi-hotspot for phone/tablet access via a WiFi hotspot.

VORLAN itself runs as a background service, started now and again automatically every time this computer starts - no need to keep a terminal or the application menu shortcut open.

Click OK to continue."

DEFAULT_SSID="VORLAN-$(hostname)"
DEFAULT_PASSWORD="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 12)"

SSID="$(ui_input "WiFi Network Name" "Choose the WiFi network name your phone/tablet will connect to:" "$DEFAULT_SSID")" || fail "Installation cancelled."
if [ -z "$SSID" ]; then SSID="$DEFAULT_SSID"; fi
PASSWORD="$(ui_password "WiFi Password" "Choose the WiFi password (leave as-is to use the generated one shown):" )"
if [ -z "$PASSWORD" ]; then PASSWORD="$DEFAULT_PASSWORD"; fi

ui_confirm "Ready to Install" "VORLAN will now install Node.js, Ollama + the phi3 model, Samba/NFS, linux-wifi-hotspot, and VORLAN itself.

WiFi network name: $SSID

This may take several minutes and will ask for your password once. Continue?" || fail "Installation cancelled."

ui_progress_start "Installing VORLAN"

ui_progress_update 10 "Installing system dependencies (Node.js, Ollama, Samba/NFS, linux-wifi-hotspot)..."
PKEXEC_LOG="$INSTALL_DIR/pkexec-system-deps.log"
if ! pkexec bash "$SCRIPT_DIR/lib/install-system-deps.sh" "$SSID" "$PASSWORD" "$(whoami)" >> "$LOG_FILE" 2>&1; then
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

ui_progress_update 90 "Setting up VORLAN's background service..."
step_write_systemd_service "$INSTALL_DIR" "$SCRIPT_DIR/systemd/vorlan.service.template" >> "$LOG_FILE" 2>&1 || { ui_progress_done; fail "Writing VORLAN's systemd service failed."; }
step_enable_systemd_service >> "$LOG_FILE" 2>&1 || { ui_progress_done; fail "Starting VORLAN's background service failed."; }

ui_progress_update 95 "Adding VORLAN to your application menu..."
mkdir -p "$HOME/.local/share/applications"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$SCRIPT_DIR/desktop/launch.sh.template" > "$INSTALL_DIR/launch.sh"
chmod +x "$INSTALL_DIR/launch.sh"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$SCRIPT_DIR/desktop/vorlan.desktop.template" > "$HOME/.local/share/applications/vorlan.desktop"

ui_progress_update 100 "Done!"
ui_progress_done

if ui_confirm "VORLAN Installed" "VORLAN is installed and added to your application menu. It's already running as a background service and will keep starting automatically every time this computer boots.

WiFi network name: $SSID
WiFi password: $PASSWORD
(keep these - you'll need them to connect a phone/tablet)

Open VORLAN now?"; then
  "$INSTALL_DIR/launch.sh" &
fi
