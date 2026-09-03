#!/usr/bin/env bash
# Dialog-backend abstraction: detects whichever GUI dialog tool is present
# (zenity, kdialog) and falls back to whiptail (terminal-based, installed on
# the spot if entirely missing - it's a tiny package present in every major
# distro's base repos). Every other installer script only calls the ui_*
# functions below, never zenity/kdialog/whiptail directly.

UI_BACKEND=""
_UI_PROGRESS_FIFO=""
_UI_PROGRESS_PID=""
_UI_PROGRESS_FD=""

ui_detect_backend() {
  if command -v zenity >/dev/null 2>&1; then
    UI_BACKEND="zenity"
  elif command -v kdialog >/dev/null 2>&1; then
    UI_BACKEND="kdialog"
  elif command -v whiptail >/dev/null 2>&1; then
    UI_BACKEND="whiptail"
  else
    echo "No dialog tool found (zenity/kdialog/whiptail) - installing whiptail as a fallback." >&2
    pkg_install_single "newt" "whiptail"
    if command -v whiptail >/dev/null 2>&1; then
      UI_BACKEND="whiptail"
    else
      echo "Could not install a dialog tool. Aborting." >&2
      return 1
    fi
  fi
  echo "Using dialog backend: $UI_BACKEND" >&2
  return 0
}

ui_message() {
  local title="$1" text="$2"
  case "$UI_BACKEND" in
    zenity) zenity --info --title="$title" --text="$text" ;;
    kdialog) kdialog --title "$title" --msgbox "$text" ;;
    whiptail) whiptail --title "$title" --msgbox "$text" 10 60 ;;
  esac
}

ui_input() {
  local title="$1" label="$2" default="$3"
  case "$UI_BACKEND" in
    zenity) zenity --entry --title="$title" --text="$label" --entry-text="$default" ;;
    kdialog) kdialog --title "$title" --inputbox "$label" "$default" ;;
    whiptail) whiptail --title "$title" --inputbox "$label" 10 60 "$default" 3>&1 1>&2 2>&3 ;;
  esac
}

ui_password() {
  local title="$1" label="$2"
  case "$UI_BACKEND" in
    zenity) zenity --password --title="$title" ;;
    kdialog) kdialog --title "$title" --password "$label" ;;
    whiptail) whiptail --title "$title" --passwordbox "$label" 10 60 3>&1 1>&2 2>&3 ;;
  esac
}

ui_confirm() {
  local title="$1" text="$2"
  case "$UI_BACKEND" in
    zenity) zenity --question --title="$title" --text="$text" ;;
    kdialog) kdialog --title "$title" --yesno "$text" ;;
    whiptail) whiptail --title "$title" --yesno "$text" 10 60 ;;
  esac
}

ui_error() {
  local title="$1" text="$2"
  case "$UI_BACKEND" in
    zenity) zenity --error --title="$title" --text="$text" ;;
    kdialog) kdialog --title "$title" --error "$text" ;;
    whiptail) whiptail --title "$title" --msgbox "ERROR: $text" 12 60 ;;
  esac
}

# Opens a persistent progress dialog. Call ui_progress_update repeatedly, then ui_progress_done.
ui_progress_start() {
  local title="$1"
  _UI_PROGRESS_FIFO="$(mktemp -u)"
  mkfifo "$_UI_PROGRESS_FIFO"
  case "$UI_BACKEND" in
    zenity)
      zenity --progress --title="$title" --percentage=0 --auto-close < "$_UI_PROGRESS_FIFO" &
      _UI_PROGRESS_PID=$!
      ;;
    kdialog)
      # kdialog has no fifo-driven mode; track a reference and call it directly from ui_progress_update.
      _UI_PROGRESS_REF=$(kdialog --title "$title" --progressbar "Starting..." 100)
      rm -f "$_UI_PROGRESS_FIFO"
      _UI_PROGRESS_FIFO=""
      return 0
      ;;
    whiptail)
      whiptail --title "$title" --gauge "Starting..." 10 70 0 < "$_UI_PROGRESS_FIFO" &
      _UI_PROGRESS_PID=$!
      ;;
  esac
  exec 9> "$_UI_PROGRESS_FIFO"
  _UI_PROGRESS_FD=9
}

ui_progress_update() {
  local percent="$1" status="$2"
  case "$UI_BACKEND" in
    zenity)
      echo "$percent" >&9
      echo "# $status" >&9
      ;;
    kdialog)
      qdbus "$_UI_PROGRESS_REF" Set "" value "$percent" >/dev/null 2>&1
      qdbus "$_UI_PROGRESS_REF" setLabelText "$status" >/dev/null 2>&1
      ;;
    whiptail)
      { echo "XXX"; echo "$percent"; echo "$status"; echo "XXX"; } >&9
      ;;
  esac
}

ui_progress_done() {
  case "$UI_BACKEND" in
    zenity|whiptail)
      exec 9>&-
      wait "$_UI_PROGRESS_PID" 2>/dev/null
      rm -f "$_UI_PROGRESS_FIFO"
      ;;
    kdialog)
      qdbus "$_UI_PROGRESS_REF" close >/dev/null 2>&1
      ;;
  esac
  _UI_PROGRESS_FIFO=""
  _UI_PROGRESS_PID=""
}
