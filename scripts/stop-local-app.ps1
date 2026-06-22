param(
  [int]$Port = 3000
)

$ErrorActionPreference = "SilentlyContinue"

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDirectory "..")
$StateDirectory = Join-Path $ProjectRoot ".localappdata"
$PidFile = Join-Path $StateDirectory "job-tracker-server.pid"
$Stopped = $false

function Show-Notice {
  param(
    [string]$Message,
    [int]$Icon = 64
  )

  try {
    $Shell = New-Object -ComObject WScript.Shell
    $null = $Shell.Popup($Message, 8, "AI Job Tracker", $Icon)
  } catch {
    Write-Host $Message
  }
}

function Stop-ProcessIfAppOwned {
  param([int]$ProcessId)

  $ProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
  if (-not $ProcessInfo) {
    return
  }

  $CommandLine = $ProcessInfo.CommandLine
  if (($CommandLine -like "*$ProjectRoot*") -or ($CommandLine -like "*next*dev*")) {
    Stop-Process -Id $ProcessId -Force
    $script:Stopped = $true
  }
}

if (Test-Path $PidFile) {
  Get-Content $PidFile | ForEach-Object {
    $ProcessId = 0
    if ([int]::TryParse($_, [ref]$ProcessId)) {
      Stop-ProcessIfAppOwned $ProcessId
    }
  }

  Remove-Item $PidFile -Force
}

Get-NetTCPConnection -LocalPort $Port -State Listen | ForEach-Object {
  Stop-ProcessIfAppOwned $_.OwningProcess
}

if ($Stopped) {
  Show-Notice "AI Job Tracker local server has been stopped."
} else {
  Show-Notice "No AI Job Tracker local server was found."
}
