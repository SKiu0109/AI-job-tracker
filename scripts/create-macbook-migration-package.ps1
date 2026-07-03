param(
  [string]$OutputDirectory = "outputs"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packageName = "pathwise-macbook-migration-$timestamp"
$stagingRoot = Join-Path $root $OutputDirectory
$stagingDir = Join-Path $stagingRoot $packageName
$zipPath = Join-Path $stagingRoot "$packageName.zip"
$resolvedStagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)
$resolvedStagingDir = [System.IO.Path]::GetFullPath($stagingDir)
$resolvedZipPath = [System.IO.Path]::GetFullPath($zipPath)

if (-not $resolvedStagingRoot.StartsWith($root.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must be inside the project root."
}

if (-not $resolvedStagingDir.StartsWith($resolvedStagingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Staging directory must stay inside the output directory."
}

if (-not $resolvedZipPath.StartsWith($resolvedStagingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Zip path must stay inside the output directory."
}

$excludedDirectories = @(
  ".agents",
  ".appdata",
  ".cache",
  ".codebuddy",
  ".codex",
  ".git",
  ".github-sync-worktree",
  ".localappdata",
  ".next",
  ".pnpm-home",
  ".pnpm-store",
  ".playwright-cli",
  ".tool-home",
  ".upload-worktree",
  ".upload-worktree-test",
  ".vercel",
  ".workbuddy",
  "audit-output",
  "coverage",
  "dist",
  "generated-images",
  "node_modules",
  "output",
  "outputs"
)

$excludedFiles = @(
  ".DS_Store",
  ".env",
  ".env.local",
  "codex-relay.err.log",
  "codex-relay.out.log",
  "nul",
  "tsconfig.tsbuildinfo"
)

New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
if (Test-Path $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    if ($excludedDirectories -contains $_.Name) {
      return
    }
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagingDir $_.Name) -Recurse -Force
    return
  }

  if ($excludedFiles -contains $_.Name) {
    return
  }

  if ($_.Name -like "*.log") {
    return
  }

  if ($_.Name -like "*.tsbuildinfo") {
    return
  }

  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagingDir $_.Name) -Force
}

Compress-Archive -LiteralPath $stagingDir -DestinationPath $zipPath -Force

Write-Output $zipPath
