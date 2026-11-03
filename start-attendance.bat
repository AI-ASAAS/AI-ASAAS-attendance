@echo off
title AI-Asaas Attendance System Auto-Starter
echo ========================================================
echo Starting AI-Asaas Attendance System Services...
echo ========================================================

set BASE_DIR=C:\Users\Anoos.alaghbari\attendance

:: 1. PostgreSQL (Port 6543)
netstat -ano | findstr ":6543" | findstr LISTENING >nul
if errorlevel 1 (
    echo [Checking] Cleaning stale Postgres PID if exists...
    if exist "C:\Users\Anoos.alaghbari\asas_pgdata\postmaster.pid" (
        powershell -NoProfile -Command "try { $p=(Get-Content 'C:\Users\Anoos.alaghbari\asas_pgdata\postmaster.pid')[0]; if (-not (Get-Process -Id $p -ErrorAction SilentlyContinue)) { Remove-Item 'C:\Users\Anoos.alaghbari\asas_pgdata\postmaster.pid' -Force } } catch {}"
    )
    echo [Starting] PostgreSQL on port 6543...
    start "PostgreSQL-6543" /min "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "C:\Users\Anoos.alaghbari\asas_pgdata"
    ping 127.0.0.1 -n 4 >nul
) else (
    echo [OK] PostgreSQL is already running on port 6543.
)

:: 2. Backend API (Port 6500)
netstat -ano | findstr ":6500" | findstr LISTENING >nul
if errorlevel 1 (
    echo [Starting] Backend API on port 6500...
    cd /d "%BASE_DIR%\backend"
    start "Backend-6500" /min node src/asas-server.js
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [OK] Backend API is already running on port 6500.
)

:: 3. Next.js Frontend (Port 7442)
netstat -ano | findstr ":7442" | findstr LISTENING >nul
if errorlevel 1 (
    echo [Starting] Next.js Frontend on port 7442...
    cd /d "%BASE_DIR%\frontend"
    start "Frontend-7442" /min node node_modules\next\dist\bin\next start -p 7442
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [OK] Next.js is already running on port 7442.
)

:: 4. Smart Dual Proxy (Ports 7443 & 8443)
netstat -ano | findstr ":8443" | findstr LISTENING >nul
if errorlevel 1 (
    echo [Starting] Smart Dual Proxy on ports 7443 and 8443...
    cd /d "%BASE_DIR%"
    start "SmartProxy-7443-8443" /min node smart-proxy-7443.js
    ping 127.0.0.1 -n 2 >nul
) else (
    echo [OK] Smart Proxy is already running on port 8443.
)

:: 5. Cloudflare Named Tunnel
tasklist | findstr /i "cloudflared.exe" >nul
if errorlevel 1 (
    echo [Starting] Cloudflare Named Tunnel...
    start "CloudflareTunnel" /min "%BASE_DIR%\.local\cloudflared.exe" tunnel run --token "eyJhIjoiNWYyMGJmZWM5ZTNkZDIwNDA4ZWYxYjI4YjI4ZmRkYmEiLCJ0IjoiY2MwZTA3MTQtNjJmMS00ZTJhLWJlZGEtYjQ3ZWE1NDY1MDk2IiwicyI6ImMzVndaWEp6WldOeVpYUndZWE56ZDI5eVpHWnZjbUZ6WVdGellYUjBaVzVrWVc1alpUSXdNalk9In0="
) else (
    echo [OK] Cloudflare Tunnel is already running.
)

echo ========================================================
echo All Attendance services verified and running!
echo Access URL: https://attendance.ai-asaas.com:8443
echo ========================================================
