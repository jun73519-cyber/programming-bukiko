@echo off
REM All-ASCII path: safe for Notepad + Desktop. No self-spawn (reliable on all PCs).
REM If nothing runs: save this file as ANSI encoding, or ensure extension is .bat not .bat.txt

chcp 65001 >nul

echo Stopping existing servers...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo Starting Arsenal (localhost:3000)...
start "Arsenal (localhost:3000)" /MIN cmd /k "cd /d C:\Users\nozoe.HYPERGEAR\src\my-projects\programming-bukiko && npm run dev"

timeout /t 4 /nobreak >nul

echo Starting Order Tool (localhost:3001)...
start "Order Tool (localhost:3001)" /MIN cmd /k "cd /d C:\Users\nozoe.HYPERGEAR\src\workspace-ui-kit && npm run dev"

timeout /t 8 /nobreak >nul

start http://localhost:3000/
exit
