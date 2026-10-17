@echo off
setlocal enabledelayedexpansion
title تهيئة قاعدة بيانات أساس - Setup Database

echo ========================================================
echo        تهيئة قاعدة بيانات نظام أساس وإنشاء المدير
echo ========================================================

cd /d "%~dp0..\..\backend"

if not exist ".env" (
    echo [خطأ] ملف backend\.env غير موجود. يرجى إنشاؤه وضبط الإعدادات أولاً.
    pause
    exit /b 1
)

echo يرجى تحديد بيانات حساب مدير النظام الأولي (Super Admin):
set /p SETUP_ADMIN_IDENTIFIER="اسم الدخول / الرقم الوظيفي للمدير (مثال: admin): "
set /p SETUP_ADMIN_PASSWORD="كلمة المرور (12 حرفاً على الأقل): "

if "%SETUP_ADMIN_IDENTIFIER%"=="" (
    echo [خطأ] اسم الدخول مطلوب.
    pause
    exit /b 1
)

echo.
echo [معلومات] جارٍ تطبيق جدول قاعدة البيانات asas-schema.sql وإنشاء حساب المدير...
set SETUP_ADMIN_IDENTIFIER=%SETUP_ADMIN_IDENTIFIER%
set SETUP_ADMIN_PASSWORD=%SETUP_ADMIN_PASSWORD%
node src/utils/setup-asas.js

if %errorlevel% equ 0 (
    echo.
    echo [نجاح] تمت تهيئة قاعدة البيانات وإنشاء الحساب بنجاح!
) else (
    echo.
    echo [خطأ] فشلت عملية التهيئة. يرجى مراجعة رسالة الخطأ أعلاه.
)

pause
