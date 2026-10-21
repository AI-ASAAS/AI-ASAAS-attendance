@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title ASAS Attendance System - Unified Launcher

echo ========================================================
echo     ASAS Attendance System - Automatic Launcher
echo ========================================================

:: Use short 8.3 path to avoid any Arabic characters encoding issue in CMD
set "ROOT=%~dps0"
cd /d "%ROOT%"

:: 1. PostgreSQL (Port 5433)
set "PGDATA=C:\Users\Anoos.alaghbari\asas_pgdata"
set "PGEXE=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
if not exist "!PGEXE!" if exist "C:\Program Files\PostgreSQL\17\bin\postgres.exe" set "PGEXE=C:\Program Files\PostgreSQL\17\bin\postgres.exe"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/4] Starting PostgreSQL Database on port 5433...
    if exist "!PGDATA!\postmaster.pid" del /f /q "!PGDATA!\postmaster.pid" >nul 2>nul
    start "Asas-PostgreSQL-5433" /min "!PGEXE!" -D "!PGDATA!" -p 5433
    timeout /t 3 /nobreak >nul
) else (
    echo [1/4] Database is already running on port 5433.
)

:: 2. Backend API (Port 5000)
netstat -ano | findstr :5000 >nul 2>nul
if !errorlevel! neq 0 (
    echo [2/4] Starting Backend API on port 5000...
    start "ASAS Backend" /min cmd /c "cd /d ""%ROOT%backend"" && node src/asas-server.js"
    timeout /t 2 /nobreak >nul
) else (
    echo [2/4] Backend API is already running on port 5000.
)

:: 3. Frontend Web App (Port 3000)
netstat -ano | findstr :3000 >nul 2>nul
if !errorlevel! neq 0 (
    echo [3/4] Starting Frontend Web App on port 3000...
    start "ASAS Frontend" /min cmd /c "cd /d ""%ROOT%frontend"" && npm start"
    timeout /t 3 /nobreak >nul
) else (
    echo [3/4] Frontend Web App is already running on port 3000.
)

:: 4. Cloudflare Tunnel (Remote URL)
tasklist | findstr /i "cloudflared.exe" >nul 2>nul
if !errorlevel! neq 0 (
    if exist "%ROOT%.local\cloudflared.exe" (
        echo [4/4] Starting Cloudflare Remote Tunnel...
        start "ASAS Cloudflare Tunnel" /min "%ROOT%.local\cloudflared.exe" tunnel --url http://localhost:3000
    )
) else (
    echo [4/4] Cloudflare Tunnel is already active.
)

timeout /t 2 /nobreak >nul
start http://localhost:3000/asas

echo.
echo ========================================================
echo All ASAS Services are LIVE and RUNNING!
echo Local Dashboard: http://localhost:3000/asas
echo Cloud Vercel:    https://ai-asaas-attendance.vercel.app/asas
echo ========================================================
