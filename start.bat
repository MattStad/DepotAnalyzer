@echo off
chcp 65001 >nul
title DepotAnalyzer
cd /d "%~dp0"

echo ===============================================
echo    DepotAnalyzer - lokaler Server
echo ===============================================
echo.
echo  Live-Daten (Yahoo Finance etc.) funktionieren nur,
echo  wenn die App ueber http:// laeuft - nicht per Doppelklick
echo  auf index.html (file://). Diese Datei erledigt das fuer dich.
echo.

set PORT=8765

REM --- Server starten (Python bevorzugt, sonst Node) ---
where python >nul 2>nul
if %errorlevel%==0 (
  start "DepotAnalyzer-Server" /min python -m http.server %PORT%
  goto open
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "DepotAnalyzer-Server" /min py -m http.server %PORT%
  goto open
)
where node >nul 2>nul
if %errorlevel%==0 (
  start "DepotAnalyzer-Server" /min npx --yes serve -l %PORT% .
  goto open
)

echo  Weder Python noch Node gefunden.
echo  Bitte Python installieren: https://www.python.org/downloads/
echo  (beim Setup "Add Python to PATH" anhaken)
echo.
pause
exit /b

:open
REM kurz warten, bis der Server gebunden hat, dann Browser oeffnen
timeout /t 2 >nul
start "" http://localhost:%PORT%/index.html
echo.
echo  App laeuft:  http://localhost:%PORT%/index.html
echo.
echo  Das minimierte Server-Fenster bitte offen lassen,
echo  solange du die App nutzt. Zum Beenden beide Fenster schliessen.
echo.
pause
