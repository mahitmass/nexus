@echo off
echo.
echo  ====================================
echo   PrahaariNet - Starting up...
echo  ====================================
echo.

if not exist backend\.env (
    echo  ERROR: backend\.env not found!
    echo  Copy backend\.env.example to backend\.env
    echo  and fill in your Neo4j credentials first.
    echo.
    pause
    exit /b 1
)

echo  Starting backend on http://localhost:8000 ...
start "PrahaariNet Backend" cmd /k "cd /d %~dp0backend && python main.py"
timeout /t 4 /nobreak >nul

echo  Starting frontend on http://localhost:3000 ...
start "PrahaariNet Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 6 /nobreak >nul

echo  Opening browser...
start http://localhost:3000
echo.
echo  Done! Close the two terminal windows to shut everything down.
pause
