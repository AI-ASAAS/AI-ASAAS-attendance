@echo off
setlocal enabledelayedexpansion
title ASAS Attendance System - Unified Launcher

echo ========================================================
echo     ASAS Attendance System - Automatic All-in-One Launcher
echo ========================================================

:: 1. Start Local Database (PostgreSQL) from project folder
for %%I in ("%~dp0database\pgdata") do set "PGDATA_DIR=%%~fsI"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/3] Starting PostgreSQL Database from project folder on port 5433...
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
    echo [1/3] Database is already running and connected on port 5433.
)

:: 2. Start Backend API
echo [2/3] Starting Backend API on port 5000...
start "ASAS Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"

ping 127.0.0.1 -n 3 >nul

:: 3. Start Frontend
echo [3/3] Starting Frontend Web App on port 3000...
start "ASAS Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm start"

ping 127.0.0.1 -n 3 >nul
start http://localhost:3000/asas

echo.
echo ========================================================
echo All services launched successfully!
echo Local Admin Dashboard : http://localhost:3000/asas
echo Employee Check-In     : http://localhost:3000/attend
echo Database Data Folder  : %~dp0database\pgdata (Port 5433)
echo ========================================================
