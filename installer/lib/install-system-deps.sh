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
