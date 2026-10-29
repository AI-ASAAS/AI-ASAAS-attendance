@echo off
setlocal enabledelayedexpansion
title ASAS - PostgreSQL Local Database (Port 6543)

echo ========================================================
echo       ASAS PostgreSQL Local Database Starter (Port 6543)
echo ========================================================

set "PGDATA_DIR=C:\Users\Anoos.alaghbari\asas_pgdata"
if not exist "!PGDATA_DIR!" (
    for %%I in ("%~dp0..\..\database\pgdata") do set "PGDATA_DIR=%%~fsI"
)

netstat -ano | findstr :6543 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/1] Starting PostgreSQL on port 6543...
    if exist "!PGDATA_DIR!\postmaster.pid" (
        echo [Clean] Removing stale postmaster.pid lock file...
        del /f /q "!PGDATA_DIR!\postmaster.pid" >nul 2>nul
    )
    set "PG_CTL=C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
    if not exist "!PG_CTL!" if exist "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" set "PG_CTL=C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
    if exist "!PG_CTL!" (
        "!PG_CTL!" start -D "!PGDATA_DIR!" -l "!PGDATA_DIR!\server.log" -s -w -t 15
    ) else (
        set "PG_EXE=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
        if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\17\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\17\bin\postgres.exe"
        start "Asas-PostgreSQL-6543" /min "!PG_EXE!" -D "!PGDATA_DIR!" -p 6543
    )
    ping 127.0.0.1 -n 4 >nul
) else (
    echo [1/1] Database is already running and connected on port 6543.
)

netstat -ano | findstr :6543 >nul 2>nul
if !errorlevel! equ 0 (
    echo [Success] Database is ready and accepting connections on port 6543!
) else (
    echo [Warning] Port 6543 did not respond yet. Check server.log.
)

if "%1" neq "--silent" pause
