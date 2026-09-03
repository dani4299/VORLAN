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
