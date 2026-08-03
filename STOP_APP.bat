@echo off
echo Closing local AstraForge Node.js and Uvicorn processes...
taskkill /FI "WINDOWTITLE eq AstraForge Frontend*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq AstraForge Backend*" /T /F >nul 2>nul
echo Done.
pause
