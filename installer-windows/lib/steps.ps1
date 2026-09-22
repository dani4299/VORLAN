# Pure, idempotent check-then-install functions for each VORLAN dependency on Windows.
# Mirrors installer/lib/steps.sh's shape (a Test-X / Install-X pair per dependency) but uses
# winget, the one package manager every supported Windows install already has, instead of the
# dnf/apt branching the Linux side needs.

$VorlanRepoUrl = "https://github.com/dani4299/VORLAN.git"

function Update-SessionPath {
    <#
    A package winget just installed often isn't on this PowerShell session's PATH yet - the
    installer wrote it to the registry, but this process's environment snapshot is from before
    that. Re-reading both PATH scopes and re-combining them (same trick used by "open a new
    terminal" instructions) means the very next command in this same script can already see it.
    #>
    $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Test-Winget {
    $null = Get-Command winget -ErrorAction SilentlyContinue
    return $?
}

function Invoke-Winget {
    param([string]$Id)
    winget install --id $Id -e --silent --accept-source-agreements --accept-package-agreements
    $ok = $LASTEXITCODE -eq 0
    Update-SessionPath
    return $ok
}

# --- Git (needed to fetch/update VORLAN itself) ---

function Test-Git {
    $null = Get-Command git -ErrorAction SilentlyContinue
    return $?
}

function Install-Git {
    return Invoke-Winget -Id "Git.Git"
}

# --- Node.js / npm ---

function Test-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { return $false }
    $major = [int]((node -e "console.log(process.versions.node.split('.')[0])").Trim())
    return $major -ge 18
}

function Install-Node {
    return Invoke-Winget -Id "OpenJS.NodeJS.LTS"
}

# --- Ollama ---

function Test-Ollama {
    $null = Get-Command ollama -ErrorAction SilentlyContinue
    return $?
}

function Install-Ollama {
    return Invoke-Winget -Id "Ollama.Ollama"
}

function Test-Model {
    param([string]$Model)
    $list = ollama list 2>$null
    # -match against an array returns the matching elements, not a boolean - cast explicitly so
    # this always returns a real [bool], not "whatever happens to be truthy-ish".
    return [bool]($list -match "^$Model(:latest)?\s")
}

function Install-Model {
    param([string]$Model)
    ollama pull $Model
    return $LASTEXITCODE -eq 0
}

# --- Docker (for the App Store; best-effort - see installer-windows/README.md) ---

function Test-Docker {
    $null = Get-Command docker -ErrorAction SilentlyContinue
    return $?
}

function Install-Docker {
    return Invoke-Winget -Id "Docker.DockerDesktop"
}

# --- VORLAN itself ---

function Get-OrUpdate-Vorlan {
    param([string]$InstallDir)
    if (Test-Path (Join-Path $InstallDir ".git")) {
        Push-Location $InstallDir
        git pull --ff-only
        $ok = $LASTEXITCODE -eq 0
        Pop-Location
        return $ok
    }
    git clone $VorlanRepoUrl $InstallDir
    return $LASTEXITCODE -eq 0
}

function Build-Vorlan {
    param([string]$InstallDir)
    Push-Location $InstallDir
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; return $false }
    Pop-Location

    Push-Location (Join-Path $InstallDir "backend")
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; return $false }
    Pop-Location

    Push-Location (Join-Path $InstallDir "frontend")
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; return $false }
    npm run build
    $ok = $LASTEXITCODE -eq 0
    Pop-Location
    return $ok
}

# --- Desktop shortcut and Start Menu entry ---

function New-VorlanShortcut {
    <#
    Writes a .lnk pointing at the silent VBScript launcher (never the .ps1 directly - PowerShell
    itself briefly flashes a console window even with -WindowStyle Hidden; the .vbs wrapper avoids
    that entirely, same reasoning a lot of "launch this script from a desktop icon" guides give).
    #>
    param(
        [string]$ShortcutPath,
        [string]$TargetVbs,
        [string]$IconPath,
        [string]$WorkingDir
    )
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetVbs
    $shortcut.WorkingDirectory = $WorkingDir
    if (Test-Path $IconPath) { $shortcut.IconLocation = $IconPath }
    $shortcut.Description = "VORLAN - self-hosted NAS and home-server dashboard"
    $shortcut.Save()
}
