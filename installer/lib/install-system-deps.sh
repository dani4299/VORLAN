#!/usr/bin/env bash
# The ONE script in this installer that runs as root - invoked once via a
# single pkexec call so there's exactly one graphical password prompt for
# the whole install, not one per privileged step. Takes the chosen WiFi
# network name and password as $1/$2.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pkg.sh"
source "$SCRIPT_DIR/steps.sh"

SSID="${1:?Usage: install-system-deps.sh <ssid> <password> <username>}"
PASSWORD="${2:?Usage: install-system-deps.sh <ssid> <password> <username>}"
USERNAME="${3:?Usage: install-system-deps.sh <ssid> <password> <username>}"

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

if step_linger_enabled "$USERNAME"; then
  echo "STEP_OK: $USERNAME already starts services at boot without logging in"
else
  echo "STEP_START: Letting $USERNAME's VORLAN service start at boot"
  step_enable_linger "$USERNAME" || { echo "STEP_FAILED: could not enable lingering for $USERNAME" >&2; exit 1; }
fi

if step_check_samba; then
  echo "STEP_OK: Samba already installed"
else
  echo "STEP_START: Installing Samba (for SMB shares)"
  step_install_samba || { echo "STEP_FAILED: Samba install failed" >&2; exit 1; }
fi

if step_check_nfs; then
  echo "STEP_OK: NFS already installed"
else
  echo "STEP_START: Installing NFS (for NFS shares)"
  step_install_nfs || { echo "STEP_FAILED: NFS install failed" >&2; exit 1; }
fi

if step_samba_shares_conf_ready; then
  echo "STEP_OK: Samba is already set up for VORLAN to manage shares"
else
  echo "STEP_START: Setting up Samba for VORLAN"
  step_setup_samba_shares_conf "$USERNAME" || { echo "STEP_FAILED: could not set up Samba's config" >&2; exit 1; }
fi

if step_nfs_exports_ready; then
  echo "STEP_OK: NFS is already set up for VORLAN to manage shares"
else
  echo "STEP_START: Setting up NFS for VORLAN"
  step_setup_nfs_exports "$USERNAME" || { echo "STEP_FAILED: could not set up NFS exports" >&2; exit 1; }
fi

if step_sharing_sudoers_ready; then
  echo "STEP_OK: $USERNAME can already manage shares without a password prompt"
else
  echo "STEP_START: Letting $USERNAME manage SMB/NFS shares"
  step_write_sharing_sudoers "$USERNAME" || { echo "STEP_FAILED: could not write the sharing sudoers rule" >&2; exit 1; }
fi

echo "STEP_START: Starting Samba and NFS"
step_enable_sharing_services || { echo "STEP_FAILED: could not enable/start Samba or NFS" >&2; exit 1; }

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
