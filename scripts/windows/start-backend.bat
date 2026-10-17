@echo off
setlocal enabledelayedexpansion
title تشغيل خادم أساس - Backend API

echo ========================================================
echo         نظام أساس للحضور والانصراف - خادم الخلفية
echo ========================================================

cd /d "%~dp0..\..\backend"

if not exist ".env" (
    echo [تنبيه] لم يتم العثور على ملف الإعدادات .env
    echo يتم الآن نسخ النموذج .env.example ...
    copy .env.example .env >nul
    echo [مهم] يرجى تعديل ملف backend\.env وضبط DATABASE_URL و QR_SECRET قبل بدء التشغيل.
    notepad .env
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطأ] Node.js غير مثبت أو غير مضاف إلى متغير PATH.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [معلومات] جارٍ تثبيت حزم الخادم...
    call npm install
)

echo [معلومات] جارٍ بدء خدمة أساس على المنفذ 5000...
node src/asas-server.js
if %errorlevel% neq 0 (
    echo [خطأ] توقفت خدمة أساس عن العمل.
    pause
)
