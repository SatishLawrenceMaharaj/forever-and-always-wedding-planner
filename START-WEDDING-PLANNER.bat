@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node.js 22 or newer is required.
    echo Please install Node.js LTS from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)
echo.
echo ===========================================
echo    FOREVER ^& ALWAYS - WEDDING PLANNER
echo ===========================================
echo.
echo Opening at http://localhost:3000
echo Password: STWed2027
echo Leave this window open while testing.
echo.
start "" "http://localhost:3000"
call npm run dev
pause
