@echo off
setlocal

cd /d "%~dp0"

set "BUNDLED_NODE=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "BUNDLED_PNPM=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"

if exist "%BUNDLED_NODE%\node.exe" (
  set "PATH=%BUNDLED_NODE%;%PATH%"
)

if exist "%BUNDLED_PNPM%" (
  echo Starting dev server with bundled pnpm...
  call "%BUNDLED_PNPM%" dev
) else (
  echo Starting dev server with system pnpm...
  pnpm dev
)

endlocal
