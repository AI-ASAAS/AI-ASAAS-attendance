@echo off
chcp 65001 >nul
title AI-Asaas Attendance System - Background Launcher
echo ========================================================
echo    تشغيل نظام حضور أساس في الخلفية (100%% Background)   
echo ========================================================

set BASE_DIR=C:\Users\Anoos.alaghbari\attendance

:: تشغيل المراقب الذكي وكافة الخدمات في الخلفية بصمت تام وبدون نوافذ
wscript.exe "%BASE_DIR%\scripts\windows\run-watchdog-hidden.vbs"

echo.
echo [✓] تم تشغيل جميع خدمات النظام والمراقب الذكي في الخلفية بنجاح!
echo [✓] النظام يعمل الآن بدون أي نوافذ سوداء أو معلقة.
echo [✓] الرابط الرسمي: https://attendance.ai-asaas.com
echo ========================================================
timeout /t 3 >nul
