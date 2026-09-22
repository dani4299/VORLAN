#Requires -Version 5.1
<#
VORLAN Windows installer.

Checks for (and installs anything missing via winget: Node.js, Ollama + the phi3 model, and
Docker Desktop for the App Store), fetches/updates VORLAN itself, builds it, then adds a desktop
shortcut and a Start Menu entry - the Windows counterpart of installer/install.sh on Linux.
Re-running is safe: every step checks first and skips what's already there.

This file is also published as a standalone download (a GitHub Release asset), so it can't assume
its lib/ siblings are sitting next to it - if they're not found, it clones the repo to get them
and re-invokes itself from inside that clone, where they exist. Same pattern as installer/install.sh.

Usage:
    powershell -ExecutionPolicy Bypass -File install.ps1
    powershell -ExecutionPolicy Bypass -File install.ps1 -InstallDir "D:\Apps\VORLAN"
#>
param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "VORLAN")
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $ScriptDir "lib\steps.ps1"))) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "git is required to run this installer (it fetches VORLAN's install scripts). Please install git and try again." -ForegroundColor Red
        exit 1
    }
    $bootstrapDir = Join-Path ([System.IO.Path]::GetTempPath()) ("vorlan-install-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
    Write-Host "Fetching installer files..."
    git clone --quiet "https://github.com/dani4299/VORLAN.git" $bootstrapDir
    if ($LASTEXITCODE -ne 0) { Write-Host "Could not fetch VORLAN's installer files." -ForegroundColor Red; exit 1 }
    & (Join-Path $bootstrapDir "installer-windows\install.ps1") -InstallDir $InstallDir
    exit $LASTEXITCODE
}

. (Join-Path $ScriptDir "lib\steps.ps1")

function Write-Step($Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok($Message) { Write-Host "    OK: $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "    Warning: $Message" -ForegroundColor Yellow }
function Write-Fail($Message) { Write-Host "    FAILED: $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "VORLAN - Windows installer" -ForegroundColor White
Write-Host "Installing to: $InstallDir"
Write-Host ""

if (-not (Test-Winget)) {
    Write-Fail "winget (the Windows Package Manager) isn't available."
    Write-Host "    Install 'App Installer' from the Microsoft Store, then run this again: https://apps.microsoft.com/detail/9nblggh4nns1"
    exit 1
}

# --- Dependencies ---

Write-Step "Git"
if (Test-Git) {
    Write-Ok "already installed"
} else {
    Write-Host "    installing..."
    if (Install-Git) { Write-Ok "installed" } else { Write-Fail "Git install failed - install it manually from https://git-scm.com and re-run this script"; exit 1 }
}

Write-Step "Node.js"
if (Test-Node) {
    Write-Ok "already installed"
} else {
    Write-Host "    installing..."
    if (Install-Node) { Write-Ok "installed" } else { Write-Fail "Node.js install failed - install it manually from https://nodejs.org and re-run this script"; exit 1 }
}

Write-Step "Ollama"
if (Test-Ollama) {
    Write-Ok "already installed"
} else {
    Write-Host "    installing..."
    if (Install-Ollama) { Write-Ok "installed" } else { Write-Warn "Ollama install failed - the AI Assistant needs it, but the rest of VORLAN works without it. Install it later from https://ollama.com" }
}

if (Test-Ollama) {
    Write-Step "phi3 model (for the AI Assistant)"
    if (Test-Model -Model "phi3") {
        Write-Ok "already pulled"
    } else {
        Write-Host "    pulling (this can take a few minutes)..."
        if (Install-Model -Model "phi3") { Write-Ok "pulled" } else { Write-Warn "couldn't pull phi3 - run 'ollama pull phi3' yourself later" }
    }
}

Write-Step "Docker Desktop (for the App Store)"
if (Test-Docker) {
    Write-Ok "already installed"
} else {
    Write-Host "    installing..."
    if (Install-Docker) {
        Write-Ok "installed"
        Write-Warn "Docker Desktop needs WSL2 and virtualization turned on to actually start. If it doesn't come up after a restart, see installer-windows\README.md."
    } else {
        Write-Warn "Docker Desktop install failed - the App Store needs it, but the rest of VORLAN works without it. See installer-windows\README.md for manual install steps."
    }
}

# --- VORLAN itself ---

Write-Step "VORLAN"
Write-Host "    fetching/updating..."
if (-not (Get-OrUpdate-Vorlan -InstallDir $InstallDir)) {
    Write-Fail "couldn't fetch VORLAN - check your internet connection and that git is working, then re-run this script"
    exit 1
}
Write-Ok "up to date"

Write-Host "    installing dependencies and building the frontend (this can take a few minutes)..."
if (-not (Build-Vorlan -InstallDir $InstallDir)) {
    Write-Fail "npm install/build failed - see the output above"
    exit 1
}
Write-Ok "built"

# --- Launcher, desktop shortcut, Start Menu entry ---

Write-Step "Shortcuts"
$launchPs1Content = (Get-Content (Join-Path $ScriptDir "desktop\launch.ps1.template") -Raw) -replace [regex]::Escape("__INSTALL_DIR__"), $InstallDir
Set-Content -Path (Join-Path $InstallDir "launch.ps1") -Value $launchPs1Content -Encoding UTF8
Copy-Item (Join-Path $ScriptDir "desktop\launch.vbs.template") (Join-Path $InstallDir "launch.vbs") -Force

$iconSrc = Join-Path $ScriptDir "assets\vorlan.ico"
$iconDst = Join-Path $InstallDir "vorlan.ico"
if (Test-Path $iconSrc) { Copy-Item $iconSrc $iconDst -Force }

$vbsPath = Join-Path $InstallDir "launch.vbs"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "VORLAN.lnk"
New-VorlanShortcut -ShortcutPath $desktopShortcut -TargetVbs $vbsPath -IconPath $iconDst -WorkingDir $InstallDir
Write-Ok "desktop shortcut created"

# A shortcut under the per-user Start Menu Programs folder is what makes an app show up in
# Windows' Start menu / "all apps" list - there's no separate registration step beyond this.
$startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "VORLAN"
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
$startMenuShortcut = Join-Path $startMenuDir "VORLAN.lnk"
New-VorlanShortcut -ShortcutPath $startMenuShortcut -TargetVbs $vbsPath -IconPath $iconDst -WorkingDir $InstallDir
Write-Ok "added to the Start menu"

Write-Host ""
Write-Host "Done. VORLAN is installed at $InstallDir." -ForegroundColor White
Write-Host "Open it from the desktop shortcut or the Start menu. The first account you create becomes the administrator."
Write-Host ""
