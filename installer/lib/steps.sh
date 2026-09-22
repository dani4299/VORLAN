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

# --- Docker (needed for VORLAN's App Store; skipped, never reinstalled, if already present) ---

step_check_docker() {
  command -v docker >/dev/null 2>&1
}

step_install_docker() {
  # The official convenience script picks the right install method for either distro itself (the
  # same reason it's used for Ollama above), so there's no dnf/apt-specific package name to get
  # wrong here. It also enables and starts the systemd service on its own.
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] curl -fsSL https://get.docker.com | sh"
    return 0
  fi
  curl -fsSL https://get.docker.com | sh
}

step_docker_user_in_group() {
  local username="$1"
  id -nG "$username" 2>/dev/null | tr ' ' '\n' | grep -qx docker
}

# Lets that account talk to the Docker socket without sudo - VORLAN itself runs as this user, not
# root. Takes effect on that user's next login (a fresh sign-in, not just closing a terminal), which
# install.sh's finishing message says.
step_add_user_to_docker_group() {
  local username="$1"
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] usermod -aG docker $username"
    return 0
  fi
  usermod -aG docker "$username"
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
