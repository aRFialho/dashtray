@echo off
setlocal
cd /d "%~dp0"
echo Aplicando hotfix Live Coach v1.6.1...
node scripts\apply-live-coach-v1.6.1.mjs
if errorlevel 1 (
  echo.
  echo Nao foi possivel aplicar a correcao.
  pause
  exit /b 1
)
echo.
echo Correcao aplicada. Execute npm run build e publique no Render.
pause
