@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title تشغيل واجهة أساس - Next.js Frontend (Port 7443)

echo ========================================================
echo         نظام أساس للحضور والانصراف - لوحة التحكم
echo ========================================================

cd /d "%~dp0..\..\frontend"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطأ] Node.js غير مثبت أو غير مضاف إلى متغير PATH.
    pause
    exit /b 1
)

set "PORT=%1"
if "%PORT%"=="" set "PORT=7443"

echo [معلومات] جارٍ تشغيل لوحة التحكم بالنمط السريع على المنفذ %PORT%...
echo يمكنك فتح الرابط التالي في المتصفح: http://localhost:%PORT%
call "%~dp0..\..\frontend\run-frontend.bat" %PORT%
if %errorlevel% neq 0 (
    echo [خطأ] توقفت واجهة المستخدم عن العمل.
    pause
)
