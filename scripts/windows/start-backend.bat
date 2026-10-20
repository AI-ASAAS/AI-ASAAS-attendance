@echo off
setlocal enabledelayedexpansion
title ASAS Backend API

echo ========================================================
echo         ASAS Attendance System - Backend Server
echo ========================================================

cd /d "%~dp0..\..\backend"

if not exist ".env" (
    echo [Notice] .env file not found. Copying .env.example ...
    copy .env.example .env >nul
    notepad .env
    pause
    exit /b 1
)

for %%I in ("%~dp0..\..\database\pgdata") do set "PGDATA_DIR=%%~fsI"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [Info] Starting PostgreSQL from project folder on port 5433...
    if exist "!PGDATA_DIR!\postmaster.pid" (
        del /f /q "!PGDATA_DIR!\postmaster.pid" >nul 2>nul
    )
    set "PG_EXE=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\17\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\17\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\16\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\16\bin\postgres.exe"
    if exist "!PG_EXE!" (
        start "Asas-PostgreSQL-5433" /min "!PG_EXE!" -D "!PGDATA_DIR!" -p 5433
        ping 127.0.0.1 -n 4 >nul
    )
)

echo [Info] Starting ASAS Backend API on port 5000...
node src/asas-server.js
if %errorlevel% neq 0 (
    echo [Error] ASAS Backend stopped unexpectedly.
    pause
)
