<#
.SYNOPSIS
    The installer for the Dedalus CLI on Windows.

.DESCRIPTION
    Detects the host architecture, downloads the matching release archive from
    https://github.com/dedalus-labs/dedalus-cli/releases, extracts dedalus.exe,
    and installs it to $HOME\.local\bin (overridable). Optionally adds the
    install directory to the user PATH via the registry.

    Mirrors scripts/install.sh 1:1 so docs, env vars, and muscle memory are
    symmetric across macOS, Linux, and Windows.

.PARAMETER InstallDir
    Install directory. Defaults to $env:DEDALUS_INSTALL_DIR, then $HOME\.local\bin.

.PARAMETER Version
    Version tag to install (e.g. v0.1.0). Defaults to $env:DEDALUS_VERSION,
    then the latest GitHub release.

.PARAMETER NoModifyPath
    Skip modifying the user PATH. Also honored via $env:DEDALUS_NO_MODIFY_PATH=1.

.EXAMPLE
    irm https://raw.githubusercontent.com/dedalus-labs/dedalus-cli/main/scripts/install.ps1 | iex

.EXAMPLE
    # Pin a version
    iex "& {$(irm https://raw.githubusercontent.com/dedalus-labs/dedalus-cli/main/scripts/install.ps1)} -Version v0.1.0"
#>

[CmdletBinding()]
param (
    [string]$InstallDir,
    [string]$Version,
    [switch]$NoModifyPath
)

$ErrorActionPreference = 'Stop'

$Repo   = 'dedalus-labs/dedalus-cli'
$Binary = 'dedalus'

function Write-Info    { param([string]$Message) Write-Host "[INFO]  $Message" -ForegroundColor Cyan }
function Write-Ok      { param([string]$Message) Write-Host "[OK]    $Message" -ForegroundColor Green }
function Write-Warn    { param([string]$Message) Write-Host "[WARN]  $Message" -ForegroundColor Yellow }
function Write-Err     { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Show-Banner {
    $art = @'

                                                ..
                                                ..
                                               ...
                                              ....
                                             ....
                                            .....
                                           .....
                                         ......
                                      ........
                                    ........
                                 .........
                             ...........       ...
                         ............         ....
                     .............           ....
                 ..............            .....
             ..............              ......
         ..............                .......
      ............                   .......
    .........                     ........
  ........                     .........
 ......                   ...........
......               ............
.....                                      ..
....                                    ....
...                                    ....
..                                 .......
.                            ..........
.               ....................
.            ..................

  Dedalus CLI - dedaluslabs.ai

'@
    Write-Host $art
}

function Assert-Environment {
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-Err "PowerShell 5.1 or newer is required (found $($PSVersionTable.PSVersion))."
        Write-Err "Upgrade: https://learn.microsoft.com/powershell/scripting/install/installing-powershell"
        exit 1
    }

    $policy = Get-ExecutionPolicy
    $allowed = @('Unrestricted', 'RemoteSigned', 'Bypass')
    if ($policy -notin $allowed) {
        Write-Err "PowerShell execution policy is '$policy'; need one of: $($allowed -join ', ')."
        Write-Err "Run: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser"
        exit 1
    }

    # GitHub requires TLS 1.2. PS 5.1 defaults to TLS 1.0/1.1 on older Windows.
    if ([Net.ServicePointManager]::SecurityProtocol -notmatch 'Tls12') {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    }
}

function Get-Arch {
    $raw = $null
    try {
        $raw = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    } catch {
        $raw = $env:PROCESSOR_ARCHITECTURE
    }

    switch -Regex ($raw) {
        '^(X64|AMD64)$' { return 'amd64' }
        '^ARM64$'       { return 'arm64' }
        '^(X86|IA32)$'  { return '386' }
        default {
            Write-Err "Unsupported architecture: $raw"
            exit 1
        }
    }
}

function Get-LatestVersion {
    # The /releases/latest URL 302-redirects to /releases/tag/<version>.
    # PowerShell treats a 302 as terminating when MaximumRedirection is 0, so wrap in try/catch.
    $url = "https://github.com/$Repo/releases/latest"
    try {
        $response = Invoke-WebRequest -Uri $url -MaximumRedirection 0 -UseBasicParsing -ErrorAction Stop
    } catch {
        $response = $_.Exception.Response
    }

    $location = $null
    if ($response -and $response.Headers) {
        if ($response.Headers -is [System.Collections.IDictionary]) {
            $location = $response.Headers['Location']
        } else {
            $location = $response.Headers.Location
        }
    }

    if ($location -is [System.Array]) { $location = $location[0] }
    if ($location -is [System.Uri])   { $location = $location.ToString() }

    if (-not $location) {
        Write-Err "Could not determine latest version from $url"
        exit 1
    }

    $tag = ($location -split '/tag/')[-1].Trim()
    if (-not $tag) {
        Write-Err "Could not parse version tag from redirect: $location"
        exit 1
    }
    return $tag
}

function Install-Dedalus {
    param(
        [string]$Arch,
        [string]$VersionTag,
        [string]$Destination
    )

    $versionNum  = $VersionTag.TrimStart('v')
    $archiveName = "${Binary}_${versionNum}_windows_${Arch}.zip"
    $url         = "https://github.com/$Repo/releases/download/$VersionTag/$archiveName"

    $tmpdir = New-Item -ItemType Directory -Path (Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString()))
    try {
        $archivePath = Join-Path $tmpdir.FullName $archiveName
        Write-Info "Downloading $url ..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $archivePath -UseBasicParsing
        } catch {
            Write-Err "Download failed. Check that a release exists for windows/$Arch."
            Write-Err $_.Exception.Message
            exit 1
        }

        Write-Info "Extracting..."
        Expand-Archive -Path $archivePath -DestinationPath $tmpdir.FullName -Force

        $extracted = Join-Path $tmpdir.FullName "$Binary.exe"
        if (-not (Test-Path $extracted)) {
            Write-Err "Archive did not contain $Binary.exe"
            exit 1
        }

        if (-not (Test-Path $Destination)) {
            New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        }

        $target = Join-Path $Destination "$Binary.exe"
        Move-Item -Path $extracted -Destination $target -Force
        Write-Ok "Installed $Binary to $target"
    } finally {
        Remove-Item -Path $tmpdir.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-PathContains {
    param([string]$Directory)

    $sep = [System.IO.Path]::PathSeparator
    $current = ($env:PATH -split $sep) | Where-Object { $_ }
    foreach ($entry in $current) {
        if ([string]::Equals($entry.TrimEnd('\'), $Directory.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Add-UserPath {
    param([string]$Directory)

    $registryPath = 'registry::HKEY_CURRENT_USER\Environment'
    $existing = (Get-Item -LiteralPath $registryPath).GetValue('Path', '', 'DoNotExpandEnvironmentNames')
    $entries = @()
    if ($existing) {
        $entries = $existing -split ';' | Where-Object { $_ }
    }

    foreach ($entry in $entries) {
        if ([string]::Equals($entry.TrimEnd('\'), $Directory.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }

    $newPath = (@($Directory) + $entries) -join ';'
    Set-ItemProperty -Type ExpandString -LiteralPath $registryPath -Name Path -Value $newPath

    # Broadcast WM_SETTINGCHANGE so explorer/new shells pick up the change without reboot.
    # Uses a dummy env var round-trip, same trick uv uses.
    $dummy = 'DEDALUS_CLI_PATH_' + [guid]::NewGuid().ToString('N')
    [Environment]::SetEnvironmentVariable($dummy, '1', 'User')
    [Environment]::SetEnvironmentVariable($dummy, [NullString]::Value, 'User')

    $env:PATH = "$Directory;$env:PATH"
    return $true
}

function Main {
    Show-Banner
    Assert-Environment

    if (-not $InstallDir) {
        if ($env:DEDALUS_INSTALL_DIR) {
            $InstallDir = $env:DEDALUS_INSTALL_DIR
        } else {
            $InstallDir = Join-Path $HOME '.local\bin'
        }
    }

    if (-not $Version) {
        if ($env:DEDALUS_VERSION) {
            $Version = $env:DEDALUS_VERSION
        }
    }

    if (-not $NoModifyPath -and $env:DEDALUS_NO_MODIFY_PATH) {
        $NoModifyPath = $true
    }

    $arch = Get-Arch
    Write-Info "Detected windows/$arch"

    if (-not $Version) {
        $Version = Get-LatestVersion
    }
    Write-Info "Version: $Version"

    Install-Dedalus -Arch $arch -VersionTag $Version -Destination $InstallDir

    if (-not (Test-PathContains -Directory $InstallDir)) {
        if ($NoModifyPath) {
            Write-Warn "$InstallDir is not in your PATH"
            Write-Host "  Add it manually in PowerShell:"
            Write-Host "    [Environment]::SetEnvironmentVariable('Path', `"$InstallDir;`" + [Environment]::GetEnvironmentVariable('Path','User'), 'User')"
            Write-Host ""
        } else {
            if (Add-UserPath -Directory $InstallDir) {
                Write-Ok "Added $InstallDir to your user PATH"
                Write-Host "  Restart your shell for the change to take effect in new sessions."
                Write-Host ""
            }
        }
    }

    Write-Ok "Ready! Run:"
    Write-Host "  $Binary --help"
    Write-Host ""
}

Main
