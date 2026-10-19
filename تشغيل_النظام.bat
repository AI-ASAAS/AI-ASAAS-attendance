@echo off
chcp 65001 >nul
title تشغيل نظام أساس للحضور والانصراف

echo ========================================================
echo        تشغيل نظام أساس للحضور والانصراف (الخادم والواجهة)
echo ========================================================

netstat -ano | findstr :5433 >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\asas_pgdata" (
        echo [1/3] جارٍ تشغيل خدمة قاعدة البيانات PostgreSQL على المنفذ 5433...
        start "قاعدة بيانات أساس" /min "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "%USERPROFILE%\asas_pgdata" -p 5433
        timeout /t 2 /nobreak >nul
    )
)

echo [2/3] جارٍ تشغيل الخادم الخلفي (Backend) على المنفذ 5000...
start "خادم أساس - Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] جارٍ تشغيل الواجهة الأمامية (Frontend) على المنفذ 3000...
start "واجهة أساس - Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:3000/asas

echo.
echo ========================================================
echo تم تشغيل جميع الخدمات بنجاح!
echo لوحة التحكم المحلية: http://localhost:3000/asas
echo صفحة الحضور المحلية: http://localhost:3000/attend
echo بيانات المدير: admin / Admin@12345678
echo.
echo للحصول على رابط عام مجاني للهواتف عبر الإنترنت:
echo شغل الملف: scripts\windows\start-public-domain.bat
echo ========================================================
