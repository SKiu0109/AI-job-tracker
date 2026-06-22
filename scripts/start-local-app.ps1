param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDirectory "..")
$StateDirectory = Join-Path $ProjectRoot ".localappdata"
$PidFile = Join-Path $StateDirectory "job-tracker-server.pid"
$StdoutLog = Join-Path $StateDirectory "job-tracker-server.out.log"
$StderrLog = Join-Path $StateDirectory "job-tracker-server.err.log"
$AppUrl = "http://${HostName}:$Port/"

function Show-Notice {
  param(
    [string]$Message,
    [int]$Icon = 64
  )

  try {
    $Shell = New-Object -ComObject WScript.Shell
    $null = $Shell.Popup($Message, 12, "AI Job Tracker", $Icon)
  } catch {
    Write-Host $Message
  }
}

function Test-AppPort {
  try {
    $Client = New-Object System.Net.Sockets.TcpClient
    $Task = $Client.ConnectAsync($HostName, $Port)
    $Connected = $Task.Wait(500)
    $Client.Close()
    return $Connected
  } catch {
    return $false
  }
}

function Resolve-Pnpm {
  $BundledNode = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
  $BundledPnpm = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"

  if ((Test-Path $BundledNode) -and (Test-Path (Join-Path $BundledNode "node.exe"))) {
    $env:PATH = "$BundledNode;$env:PATH"
  }

  if (Test-Path $BundledPnpm) {
    return $BundledPnpm
  }

  $PnpmCommand = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
  if (-not $PnpmCommand) {
    $PnpmCommand = Get-Command "pnpm" -ErrorAction SilentlyContinue
  }

  if (-not $PnpmCommand) {
    throw "pnpm was not found. Install Node.js and pnpm, or run the app once from your development environment."
  }

  return $PnpmCommand.Source
}

try {
  New-Item -ItemType Directory -Force -Path $StateDirectory | Out-Null

  if (Test-AppPort) {
    Start-Process $AppUrl
    exit 0
  }

  $Pnpm = Resolve-Pnpm

  if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    $Install = Start-Process `
      -FilePath $Pnpm `
      -ArgumentList @("install") `
      -WorkingDirectory $ProjectRoot `
      -WindowStyle Hidden `
      -PassThru `
      -RedirectStandardOutput $StdoutLog `
      -RedirectStandardError $StderrLog

    $Install.WaitForExit()

    if ($Install.ExitCode -ne 0) {
      throw "Dependencies could not be installed. Check .localappdata logs in the project folder."
    }
  }

  $Server = Start-Process `
    -FilePath $Pnpm `
    -ArgumentList @("exec", "next", "dev", "--hostname", $HostName, "--port", $Port.ToString()) `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog

  Set-Content -Path $PidFile -Value $Server.Id -Encoding ascii

  $Deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $Deadline) {
    if (Test-AppPort) {
      Start-Process $AppUrl
      exit 0
    }

    Start-Sleep -Milliseconds 750
  }

  throw "The local app did not start within 45 seconds. Check .localappdata logs in the project folder."
} catch {
  Show-Notice $_.Exception.Message 48
  exit 1
}
