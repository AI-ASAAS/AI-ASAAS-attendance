' ASAS Attendance System - Silent Watchdog Launcher
Set WshShell = CreateObject("WScript.Shell")
psScript = "C:\Users\Anoos.alaghbari\attendance\scripts\windows\asas-watchdog.ps1"
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psScript & """ -Continuous"
WshShell.Run cmd, 0, False
