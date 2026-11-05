@echo off
chcp 65001 >nul
title ASAS Attendance System - Silent Launcher
set BASE_DIR=C:\Users\Anoos.alaghbari\attendance
wscript.exe "%BASE_DIR%\scripts\windows\run-watchdog-hidden.vbs"
timeout /t 2 >nul
