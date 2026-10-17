@echo off
setlocal enabledelayedexpansion
title استعادة نسخة احتياطية لقاعدة بيانات أساس - Restore DB

echo ========================================================
echo        استعادة نسخة احتياطية لقاعدة بيانات أساس
echo ========================================================

set BACKUP_FILE=%~1
if "%BACKUP_FILE%"=="" (
    echo [تنبيه] يرجى تحديد مسار ملف النسخة الاحتياطية.
    echo الاستخدام: restore-db.bat path\to\backup_file.dump
    set /p BACKUP_FILE="أو أدخل مسار الملف الآن: "
)

if not exist "%BACKUP_FILE%" (
    echo [خطأ] الملف المحدد غير موجود: %BACKUP_FILE%
    pause
    exit /b 1
)

set ENV_FILE=%~dp0..\..\backend\.env
if exist "%ENV_FILE%" (
    for /f "tokens=1,2 delims==" %%a in ('type "%ENV_FILE%"') do (
        if "%%a"=="DATABASE_URL" set DB_URL=%%b
    )
)

if "%DB_URL%"=="" (
    set /p DB_URL="يرجى إدخال عنوان اتصال PostgreSQL (DATABASE_URL): "
)

echo.
echo [تحذير] سيتم استعادة البيانات فوق قاعدة البيانات الحالية.
set /p CONFIRM="هل أنت متأكد من المتابعة؟ (اكتب YES للتأكيد): "
if /i not "%CONFIRM%"=="YES" (
    echo تم إلغاء العملية.
    pause
    exit /b 0
)

echo.
echo [معلومات] جارٍ استعادة البيانات من %BACKUP_FILE% ...

where pg_restore >nul 2>nul
if %errorlevel% equ 0 (
    pg_restore --clean --if-exists -d "%DB_URL%" "%BACKUP_FILE%"
    if %errorlevel% equ 0 (
        echo [نجاح] تمت استعادة النسخة الاحتياطية بنجاح!
    ) else (
        echo [تنبيه] انتهت الاستعادة مع بعض التحذيرات أو الأخطاء.
    )
) else (
    where docker >nul 2>nul
    if %errorlevel% equ 0 (
        docker run --rm -v "%~dp1:/backups" postgres:15-alpine pg_restore --clean --if-exists -d "%DB_URL%" "/backups/%~nx1"
        if %errorlevel% equ 0 (
            echo [نجاح] تمت استعادة النسخة الاحتياطية بنجاح عبر Docker!
        ) else (
            echo [خطأ] فشلت عملية الاستعادة.
        )
    ) else (
        echo [خطأ] تعذر العثور على pg_restore في PATH أو تشغيل Docker.
    )
)

pause
