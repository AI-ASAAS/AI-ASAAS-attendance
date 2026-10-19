@echo off
chcp 65001 >nul
title تشغيل الدومين العام للنظام - Public Live Domain

echo ========================================================
echo       نظام أساس - تشغيل الرابط العام المباشر (HTTPS)
echo ========================================================

cd /d "%~dp0..\.."

if not exist ".local\cloudflared.exe" (
    echo [خطأ] أداة النفق السحابي غير موجودة في .local\cloudflared.exe
    pause
    exit /b 1
)

echo [معلومات] جارٍ ربط النظام وتوليد الرابط العام المشفر (HTTPS)...
echo سيظهر لك الرابط العام بالأسفل، يمكنك نسخه وفتحه من أي هاتف أو جهاز عبر الإنترنت:
echo.
.\.local\cloudflared.exe tunnel --url http://localhost:3000
pause
