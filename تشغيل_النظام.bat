@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title نظام أساس للحضور والانصراف - تشغيل النظام الكامل

echo ========================================================
echo     نظام أساس للحضور والانصراف - تشغيل شامل وتلقائي
echo ========================================================

for %%I in ("%~dp0database\pgdata") do set "PGDATA_DIR=%%~fsI"

netstat -ano | findstr :5433 >nul 2>nul
if !errorlevel! neq 0 (
    echo [1/3] جارٍ تشغيل قاعدة البيانات PostgreSQL من مجلد المشروع على المنفذ 5433...
    if exist "!PGDATA_DIR!\postmaster.pid" (
        del /f /q "!PGDATA_DIR!\postmaster.pid" >nul 2>nul
    )
    set "PG_EXE=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\17\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\17\bin\postgres.exe"
    if not exist "!PG_EXE!" if exist "C:\Program Files\PostgreSQL\16\bin\postgres.exe" set "PG_EXE=C:\Program Files\PostgreSQL\16\bin\postgres.exe"
    if exist "!PG_EXE!" (
        start "Asas-PostgreSQL-5433" /min "!PG_EXE!" -D "!PGDATA_DIR!" -p 5433
        timeout /t 3 /nobreak >nul
    ) else (
        echo [تحذير] لم يتم العثور على postgres.exe في المسار الافتراضي.
    )
) else (
    echo [1/3] قاعدة البيانات متصلة وتعمل بالفعل على المنفذ 5433.
)

echo [2/3] جارٍ تشغيل خادم الخلفية (Backend) على المنفذ 5000...
start "خادم أساس - Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] جارٍ تشغيل واجهة النظام (Frontend) على المنفذ 3000...
start "واجهة أساس - Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm start"

timeout /t 3 /nobreak >nul
start http://localhost:3000/asas

echo.
echo ========================================================
echo تم تشغيل جميع خدمات النظام بنجاح!
echo لوحة التحكم الإدارية : http://localhost:3000/asas
echo صفحة تحضير الموظفين : http://localhost:3000/attend
echo قاعدة البيانات       : مجلد المشروع (database\pgdata) على المنفذ 5433
echo ========================================================
