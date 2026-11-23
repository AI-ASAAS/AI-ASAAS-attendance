@echo off
chcp 65001 >nul
title AI-ASAAS - Google Drive Backup
echo ===================================================
echo   جاري رفع أحدث نسخة من قاعدة البيانات إلى Google Drive...
echo ===================================================
cd /d "%~dp0..\.."
node scripts\windows\backup-gdrive.js
if %ERRORLEVEL% EQU 0 (
    echo.
    echo تم الرفع بنجاح!
) else (
    echo.
    echo حدث خطأ أثناء الرفع!
)
timeout /t 5 >nul
