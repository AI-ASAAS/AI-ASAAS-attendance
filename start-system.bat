@echo off
setlocal enabledelayedexpansion
title ASAS Attendance System - Unified Launcher

echo ========================================================
echo     ASAS Attendance System - Automatic All-in-One Launcher
echo ========================================================

:: 1. Database (PostgreSQL) in project folder on port 5433
for %%I in ("%~dp0database\pgdata") do set "PGDATA_DIR=%%~fsI"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/4] Starting PostgreSQL Database from project folder on port 5433...
    if exist "!PGDATA_DIR!\postmaster.pid" (
        del /f /q "!PGDATA_DIR!\postmaster.pid" >nul 2>nul
    )
    set "PG_EXE=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\17\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\17\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\16\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\16\bin\postgres.exe"
    if exist "!PG_EXE!" (
        start "Asas-PostgreSQL-5433" /min "!PG_EXE!" -D "!PGDATA_DIR!" -p 5433
        ping 127.0.0.1 -n 4 >nul
    ) else (
        echo [Warning] postgres.exe was not found in default paths.
    )
) else (
    echo [1/4] Database is already running on port 5433.
)

:: 2. Backend API on port 5000
netstat -ano | findstr :5000 >nul 2>nul
if !errorlevel! neq 0 (
    echo [2/4] Starting Backend API on port 5000...
    start "ASAS Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [2/4] Backend API is already running on port 5000.
)

:: 3. Frontend on port 3000
netstat -ano | findstr :3000 >nul 2>nul
if !errorlevel! neq 0 (
    echo [3/4] Starting Frontend Web App on port 3000...
    start "ASAS Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm start"
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [3/4] Frontend Web App is already running on port 3000.
)

:: 4. Cloudflare Tunnel (for external access)
tasklist | findstr /i "cloudflared.exe" >nul 2>nul
if !errorlevel! neq 0 (
    if exist "%~dp0.local\cloudflared.exe" (
        echo [4/4] Starting Cloudflare Tunnel for external / remote access...
        start "ASAS Cloudflare Tunnel" /min "%~dp0.local\cloudflared.exe" tunnel --url http://localhost:3000
    )
) else (
    echo [4/4] Cloudflare Tunnel is already active.
)

ping 127.0.0.1 -n 2 >nul
start http://localhost:3000/asas

echo.
echo ========================================================
echo All services are running and verified!
echo Local Admin Dashboard : http://localhost:3000/asas
echo Employee Check-In     : http://localhost:3000/attend
echo Database Data Folder  : %~dp0database\pgdata (Port 5433)
echo ========================================================
