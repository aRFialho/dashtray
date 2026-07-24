@echo off
setlocal
cd /d "%~dp0"
echo.
echo Instalando Live Coach v1.6...
node scripts\apply-live-coach-v1.6.mjs
if errorlevel 1 (
  echo.
  echo Falha ao aplicar a atualizacao.
  pause
  exit /b 1
)
echo.
echo Agora coloque o GIF em client\public\mascot\drossi-live.gif
echo Depois execute: npm run typecheck ^&^& npm run build
pause
