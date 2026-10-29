@echo off
setlocal enabledelayedexpansion
title ASAS Backend API (Port 6500)

echo ========================================================
echo         ASAS Attendance System - Backend Server (Port 6500)
echo ========================================================

cd /d "%~dp0..\..\backend"

if not exist ".env" (
    echo [Notice] .env file not found. Copying .env.example ...
    copy .env.example .env >nul
    notepad .env
    pause
    exit /b 1
)

set "PGDATA_DIR=C:\Users\Anoos.alaghbari\asas_pgdata"
if not exist "!PGDATA_DIR!" (
    for %%I in ("%~dp0..\..\database\pgdata") do set "PGDATA_DIR=%%~fsI"
)

netstat -ano | findstr :6543 >nul 2>nul
if !errorlevel! neq 0 (
    echo [Info] Starting PostgreSQL on port 6543...
    if exist "!PGDATA_DIR!\postmaster.pid" (
        del /f /q "!PGDATA_DIR!\postmaster.pid" >nul 2>nul
    )
    set "PG_CTL=C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
    if exist "!PG_CTL!" (
        "!PG_CTL!" start -D "!PGDATA_DIR!" -l "!PGDATA_DIR!\server.log" -s -w -t 15
    )
)

echo [Info] Starting ASAS Backend API on port 6500...
node src/asas-server.js
if %errorlevel% neq 0 (
    echo [Error] ASAS Backend stopped unexpectedly.
    pause
)
