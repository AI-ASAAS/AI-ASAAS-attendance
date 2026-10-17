@echo off
setlocal enabledelayedexpansion
title تشغيل واجهة أساس - Next.js Frontend

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

if not exist "node_modules" (
    echo [معلومات] جارٍ تثبيت حزم الواجهة الأمامية...
    call npm install
)

echo [معلومات] جارٍ تشغيل لوحة التحكم على المنفذ 3000...
echo يمكنك فتح الرابط التالي في المتصفح: http://localhost:3000
npm run dev
if %errorlevel% neq 0 (
    echo [خطأ] توقفت واجهة المستخدم عن العمل.
    pause
)
