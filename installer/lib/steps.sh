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

# --- Lingering (lets VORLAN's user systemd service start at boot with nobody logged in) ---

step_linger_enabled() {
  local username="$1"
  loginctl show-user "$username" -p Linger --value 2>/dev/null | grep -qx yes
}

step_enable_linger() {
  local username="$1"
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] loginctl enable-linger $username"
    return 0
  fi
  loginctl enable-linger "$username"
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

# --- SMB/NFS sharing (Phase 7) ---

step_check_samba() {
  command -v smbpasswd >/dev/null 2>&1
}

step_install_samba() {
  pkg_install_list "samba" "samba"
}

step_check_nfs() {
  command -v exportfs >/dev/null 2>&1
}

step_install_nfs() {
  pkg_install_list "nfs-utils" "nfs-kernel-server"
}

# Debian/Ubuntu's smbd/nmbd service units are named that; Fedora's samba package names them smb/nmb.
step_samba_service_names() {
  case "$PKG_MANAGER" in
    dnf) echo "smb nmb" ;;
    apt) echo "smbd nmbd" ;;
  esac
}

step_nfs_service_name() {
  echo "nfs-server"
}

step_enable_sharing_services() {
  local services
  services="$(step_samba_service_names) $(step_nfs_service_name)"
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] systemctl enable --now $services"
    return 0
  fi
  # shellcheck disable=SC2086
  systemctl enable --now $services
}

# VORLAN writes/rewrites these two files itself at runtime (never needs root for that) - this step
# only needs to run once, to create them owned by the installing user instead of root, and to make
# sure Samba/exportfs actually read them.
step_samba_shares_conf_ready() {
  [ -O /etc/samba/vorlan-shares.conf ] 2>/dev/null
}

step_setup_samba_shares_conf() {
  local username="$1"
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] touch /etc/samba/vorlan-shares.conf && chown $username /etc/samba/vorlan-shares.conf"
    echo "[DRY RUN] ensure smb.conf [global] includes it"
    return 0
  fi
  touch /etc/samba/vorlan-shares.conf
  chown "$username" /etc/samba/vorlan-shares.conf
  if ! grep -q '^\s*include\s*=\s*/etc/samba/vorlan-shares.conf' /etc/samba/smb.conf 2>/dev/null; then
    # Appended right after [global] so it's read as part of the global section, the same place a
    # person would put it by hand per Samba's own documentation for a per-share include.
    awk '
      /^\[global\]/ && !done { print; print "   include = /etc/samba/vorlan-shares.conf"; done=1; next }
      { print }
    ' /etc/samba/smb.conf > /etc/samba/smb.conf.vorlan-tmp && mv /etc/samba/smb.conf.vorlan-tmp /etc/samba/smb.conf
  fi
}

step_nfs_exports_ready() {
  [ -O /etc/exports.d/vorlan.exports ] 2>/dev/null
}

step_setup_nfs_exports() {
  local username="$1"
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] mkdir -p /etc/exports.d && touch /etc/exports.d/vorlan.exports && chown $username /etc/exports.d/vorlan.exports"
    echo "[DRY RUN] ensure /etc/exports includes /etc/exports.d/*.exports"
    return 0
  fi
  mkdir -p /etc/exports.d
  touch /etc/exports.d/vorlan.exports
  chown "$username" /etc/exports.d/vorlan.exports
  touch /etc/exports
  if ! grep -q '^\.include /etc/exports\.d/\*\.exports' /etc/exports 2>/dev/null; then
    echo '.include /etc/exports.d/*.exports' >> /etc/exports
  fi
}

# One narrow, passwordless-sudo rule for the installing user, covering only the exact commands
# VORLAN's backend needs at runtime to manage shares (it never runs as root itself - see
# sharing.service.js). Validated with `visudo -c` on a temp file before it ever touches
# /etc/sudoers.d, since a broken sudoers file can lock sudo out system-wide.
step_sharing_sudoers_ready() {
  [ -f /etc/sudoers.d/vorlan-sharing ]
}

step_write_sharing_sudoers() {
  local username="$1"
  # Resolved here, not hardcoded, so this works whichever path each distro's package actually
  # installs to - sudo matches a rule against the resolved real path of what it's asked to run, so
  # this only works cleanly if the rule names that same real path.
  local smbpasswd_bin exportfs_bin smbcontrol_bin
  smbpasswd_bin="$(command -v smbpasswd)" || { echo "step_write_sharing_sudoers: smbpasswd not found" >&2; return 1; }
  exportfs_bin="$(command -v exportfs)" || { echo "step_write_sharing_sudoers: exportfs not found" >&2; return 1; }
  smbcontrol_bin="$(command -v smbcontrol)" || { echo "step_write_sharing_sudoers: smbcontrol not found" >&2; return 1; }
  local content
  content=$(cat <<EOF
# Written by the VORLAN installer. VORLAN's backend runs as $username, never as root; this grants
# it exactly the commands it needs to manage SMB/NFS shares, nothing broader.
$username ALL=(root) NOPASSWD: $smbpasswd_bin -s -a *
$username ALL=(root) NOPASSWD: $smbpasswd_bin -s -x *
$username ALL=(root) NOPASSWD: $smbcontrol_bin smbd reload-config
$username ALL=(root) NOPASSWD: $exportfs_bin -ra
EOF
)
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] write /etc/sudoers.d/vorlan-sharing (validated with visudo -c first):"
    echo "$content"
    return 0
  fi
  local tmp
  tmp=$(mktemp)
  echo "$content" > "$tmp"
  if ! visudo -c -f "$tmp" >/dev/null 2>&1; then
    echo "step_write_sharing_sudoers: generated sudoers content failed validation, not installing it" >&2
    rm -f "$tmp"
    return 1
  fi
  install -m 0440 -o root -g root "$tmp" /etc/sudoers.d/vorlan-sharing
  rm -f "$tmp"
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

# Keeps VORLAN running: starts it at boot, restarts it if it crashes. A user unit (see
# vorlan.service.template's own comment for why), so none of this needs root.
step_write_systemd_service() {
  local install_dir="$1" template_path="$2"
  local node_bin
  node_bin="$(command -v node)"
  local unit_dir="$HOME/.config/systemd/user"
  local content
  content=$(sed -e "s|__INSTALL_DIR__|$install_dir|g" -e "s|__NODE_BIN__|$node_bin|g" "$template_path")
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] write $unit_dir/vorlan.service:"
    echo "$content"
    return 0
  fi
  mkdir -p "$unit_dir"
  echo "$content" > "$unit_dir/vorlan.service"
}

step_enable_systemd_service() {
  if [ "${VORLAN_DRY_RUN:-}" = "1" ]; then
    echo "[DRY RUN] systemctl --user daemon-reload"
    echo "[DRY RUN] systemctl --user enable --now vorlan.service"
    return 0
  fi
  systemctl --user daemon-reload
  systemctl --user enable --now vorlan.service
}

step_systemd_service_active() {
  systemctl --user is-active --quiet vorlan.service 2>/dev/null
}
