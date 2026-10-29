@echo off
chcp 65001 >nul
title ASAS Attendance System - Smart Failover Launcher
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-asas.ps1"
if %errorlevel% neq 0 (
    echo [خطأ] حدث خطأ أثناء تشغيل النظام.
    pause
)
