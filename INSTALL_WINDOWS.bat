@echo off
echo.
echo  ====================================
echo   PrahaariNet - First Time Setup
echo   Run this ONCE before anything else
echo  ====================================
echo.

echo  Step 1: Installing Python packages...
cd /d %~dp0backend
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo  ERROR: pip install failed.
    echo  Make sure Python 3.10+ is installed.
    pause
    exit /b 1
)

echo.
echo  Step 2: Installing Node packages...
cd /d %~dp0frontend
npm install
if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed.
    echo  Make sure Node.js 18+ is installed.
    pause
    exit /b 1
)

echo.
echo  Step 3: Creating your .env file...
cd /d %~dp0backend
if not exist .env (
    copy .env.example .env
    echo  Created backend\.env
    echo.
    echo  *** ACTION REQUIRED ***
    echo  Open backend\.env in Notepad and fill in:
    echo    - NEO4J_URI   (from console.neo4j.io)
    echo    - NEO4J_PASSWORD
    echo.
    notepad .env
) else (
    echo  backend\.env already exists, skipping.
)

echo.
echo  ====================================
echo   Setup complete!
echo   Now run START_WINDOWS.bat to launch.
echo  ====================================
pause
