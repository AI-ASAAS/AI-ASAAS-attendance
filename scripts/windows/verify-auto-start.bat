@echo off
chcp 65001 >nul
title ASAS Attendance - Verify Boot Auto-Start Task
setlocal enabledelayedexpansion

set "CLI_MODE=0"
set "PS_ARGS="

:: Inspect and normalize parameters
for %%A in (%*) do (
    if /i "%%~A"=="--cli" (
        set "CLI_MODE=1"
        set "PS_ARGS=!PS_ARGS! -cli"
    ) else if /i "%%~A"=="-cli" (
        set "CLI_MODE=1"
        set "PS_ARGS=!PS_ARGS! -cli"
    ) else (
        set "PS_ARGS=!PS_ARGS! %%A"
    )
)

:: If any parameter was passed, activate CLI mode
if not "%~1"=="" set "CLI_MODE=1"

:: Check common CI/Automation environment variables
if defined CI set "CLI_MODE=1"
if defined AUTOMATION set "CLI_MODE=1"
if defined TF_BUILD set "CLI_MODE=1"
if defined GITHUB_ACTIONS set "CLI_MODE=1"

:: Detect non-interactive / redirected shell
if "!CLI_MODE!"=="0" (
    timeout /t 1 >nul 2>&1
    if errorlevel 1 set "CLI_MODE=1"
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-auto-start.ps1" %PS_ARGS%
set "EXITCODE=%ERRORLEVEL%"

if "!CLI_MODE!"=="0" pause

exit /b %EXITCODE%
