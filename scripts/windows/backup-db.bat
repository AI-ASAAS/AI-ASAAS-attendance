@echo off
setlocal enabledelayedexpansion
title النسخ الاحتياطي لقاعدة بيانات أساس - Backup DB

echo ========================================================
echo        النسخ الاحتياطي لقاعدة بيانات نظام أساس
echo ========================================================

set BACKUP_DIR=%~dp0..\..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set TIMESTAMP=%dt:~0,4%%dt:~4,2%%dt:~6,2%_%dt:~8,2%%dt:~10,2%%dt:~12,2%
set DUMP_FILE=%BACKUP_DIR%\asas_backup_%TIMESTAMP%.dump
set SQL_FILE=%BACKUP_DIR%\asas_backup_%TIMESTAMP%.sql

set ENV_FILE=%~dp0..\..\backend\.env
if exist "%ENV_FILE%" (
    for /f "tokens=1,2 delims==" %%a in ('type "%ENV_FILE%"') do (
        if "%%a"=="DATABASE_URL" set DB_URL=%%b
    )
)

if "%DB_URL%"=="" (
    echo [تنبيه] لم يتم العثور على DATABASE_URL في ملف backend\.env
    set /p DB_URL="يرجى إدخال عنوان اتصال PostgreSQL (DATABASE_URL): "
)

where pg_dump >nul 2>nul
if %errorlevel% neq 0 (
    echo [تنبيه] أمر pg_dump غير متاح مباشرة في PATH.
    echo يتم التحقق من وجود Docker...
    where docker >nul 2>nul
    if %errorlevel% equ 0 (
        echo [معلومات] سيتم تنفيذ النسخ الاحتياطي عبر حاوية docker postgres...
        docker run --rm -v "%BACKUP_DIR%:/backups" postgres:15-alpine pg_dump "%DB_URL%" -Fc -f "/backups/asas_backup_%TIMESTAMP%.dump"
        if %errorlevel% equ 0 (
            echo.
            echo [نجاح] تم حفظ النسخة الاحتياطية بنجاح:
            echo %DUMP_FILE%
            exit /b 0
        )
    )
    echo [خطأ] تعذر العثور على pg_dump أو تشغيل Docker. يرجى تثبيت أدوات عميل PostgreSQL.
    pause
    exit /b 1
)

echo [معلومات] جارٍ إنشاء النسخة الاحتياطية...
pg_dump "%DB_URL%" -Fc -f "%DUMP_FILE%"
if %errorlevel% equ 0 (
    echo [معلومات] إنشاء نسخة SQL نصية إضافية...
    pg_dump "%DB_URL%" -f "%SQL_FILE%"
    echo.
    echo [نجاح] تم حفظ النسخة الاحتياطية بنجاح في:
    echo %DUMP_FILE%
    echo %SQL_FILE%
) else (
    echo.
    echo [خطأ] فشل أخذ النسخة الاحتياطية. يرجى التحقق من صحة اتصال قاعدة البيانات.
)

pause
