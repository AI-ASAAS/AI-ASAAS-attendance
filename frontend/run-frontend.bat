@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PORT=%1"
if "%PORT%"=="" set "PORT=7443"
node node_modules\next\dist\bin\next start -p %PORT%
