@echo off
setlocal enabledelayedexpansion
title ASAS - PostgreSQL Local Database

echo ========================================================
echo       ASAS PostgreSQL Local Database Starter
echo ========================================================

for %%I in ("%~dp0..\..\database\pgdata") do set "PGDATA_DIR=%%~fsI"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/1] Starting PostgreSQL from project folder on port 5433...
    if exist "!PGDATA_DIR!\postmaster.pid" (
        echo [Clean] Removing stale postmaster.pid lock file...
        del /f /q "!PGDATA_DIR!\postmaster.pid" >nul 2>nul
    )
    set "PG_EXE=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\17\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\17\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\16\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\16\bin\postgres.exe"
    if exist "!PG_EXE!" (
        start "Asas-PostgreSQL-5433" /min "!PG_EXE!" -D "!PGDATA_DIR!" -p 5433
        ping 127.0.0.1 -n 4 >nul
    ) else (
        echo [Error] postgres.exe was not found in C:\Program Files\PostgreSQL
        pause
        exit /b 1
    )
) else (
    echo [1/1] Database is already running and connected on port 5433.
)

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! equ 0 (
    echo [Success] Database is ready and accepting connections on port 5433!
) else (
    echo [Warning] Port 5433 did not respond yet. Check server.log.
)

if "%1" neq "--silent" pause
