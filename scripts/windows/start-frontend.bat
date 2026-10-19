@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
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

if not exist ".next" (
    echo [معلومات] جارٍ بناء ملفات الإنتاج لضمان أقصى سرعة...
    call npm run build
)

echo [معلومات] جارٍ تشغيل لوحة التحكم بالنمط السريع على المنفذ 3000...
echo يمكنك فتح الرابط التالي في المتصفح: http://localhost:3000
npm start
if %errorlevel% neq 0 (
    echo [خطأ] توقفت واجهة المستخدم عن العمل.
    pause
)
