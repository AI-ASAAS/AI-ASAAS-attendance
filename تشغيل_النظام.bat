@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title نظام أساس للحضور والانصراف - تشغيل النظام الشامل

echo ========================================================
echo     نظام أساس للحضور والانصراف - التشغيل الذكي الشامل
echo ========================================================

:: 1. قاعدة البيانات المحلية
for %%I in ("%~dp0database\pgdata") do set "PGDATA_DIR=%%~fsI"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/4] جارٍ تشغيل قاعدة البيانات PostgreSQL من مجلد المشروع على المنفذ 5433...
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
        echo [تحذير] لم يتم العثور على postgres.exe في المسار الافتراضي.
    )
) else (
    echo [1/4] قاعدة البيانات متصلة وتعمل بالفعل على المنفذ 5433.
)

:: 2. خادم الخلفية Backend
netstat -ano | findstr :5000 >nul 2>nul
if !errorlevel! neq 0 (
    echo [2/4] جارٍ تشغيل خادم الخلفية (Backend) على المنفذ 5000...
    start "خادم أساس - Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [2/4] خادم الخلفية يعمل بالفعل على المنفذ 5000.
)

:: 3. واجهة النظام Frontend
netstat -ano | findstr :3000 >nul 2>nul
if !errorlevel! neq 0 (
    echo [3/4] جارٍ تشغيل واجهة النظام (Frontend) على المنفذ 3000...
    start "واجهة أساس - Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm start"
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [3/4] واجهة النظام تعمل بالفعل على المنفذ 3000.
)

:: 4. نفق الاتصال السحابي Cloudflare
tasklist | findstr /i "cloudflared.exe" >nul 2>nul
if !errorlevel! neq 0 (
    if exist "%~dp0.local\cloudflared.exe" (
        echo [4/4] جارٍ تشغيل نفق الاتصال السحابي...
        start "نفق أساس - Cloudflare" /min "%~dp0.local\cloudflared.exe" tunnel --url http://localhost:3000
    )
) else (
    echo [4/4] نفق الاتصال السحابي يعمل بالفعل.
)

ping 127.0.0.1 -n 2 >nul
start http://localhost:3000/asas

echo.
echo ========================================================
echo جميع خدمات النظام تعمل وجاهزة للاستخدام!
echo لوحة التحكم الإدارية : http://localhost:3000/asas
echo صفحة تحضير الموظفين : http://localhost:3000/attend
echo قاعدة البيانات       : %~dp0database\pgdata (Port 5433)
echo ========================================================
