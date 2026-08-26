@echo off
title PrintATM Server Launcher
color 0A
echo ==================================================
echo               Starting PrintATM Kiosk
echo ==================================================
echo.

:: Kill any stale process on port 4000 before starting
echo Checking for stale processes on port 4000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Also kill any stale process on port 5173
echo Checking for stale processes on port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Ports cleared. Launching PrintATM servers...
echo.

:: Check if node_modules exist, if not run installation first
if not exist "node_modules\" (
    echo Installing workspace dependencies first...
    call npm install
)
if not exist "server\node_modules\" (
    echo Installing server dependencies...
    cd server && call npm install && cd ..
)
if not exist "client\node_modules\" (
    echo Installing client dependencies...
    cd client && call npm install && cd ..
)

echo.
echo Launching backend API (port 4000) and frontend (port 5173)...
echo Open browser at: http://localhost:5173
echo Close this window to stop the application.
echo.

call npm run dev

pause
