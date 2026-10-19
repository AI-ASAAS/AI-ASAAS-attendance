@echo off
chcp 65001 >nul
title رفع التعديلات إلى GitHub - Push to GitHub
cd /d "%~dp0..\.."

echo ========================================================
echo          جارٍ رفع التعديلات إلى مستودع GitHub
echo ========================================================
echo.
"%LOCALAPPDATA%\Programs\Git\cmd\git.exe" push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo [نجاح] تم رفع جميع التعديلات بنجاح إلى GitHub!
    echo ========================================================
) else (
    echo.
    echo [خطأ] تعذر الرفع، يرجى التأكد من تسجيل الدخول.
)

pause
