# ASAS Attendance System - Silent Background Launcher
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$vbs = "C:\Users\Anoos.alaghbari\attendance\scripts\windows\run-watchdog-hidden.vbs"
if (Test-Path $vbs) {
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`"" -WindowStyle Hidden
}
Write-Host "[OK] ASAS Attendance System is running silently in the background." -ForegroundColor Green
Write-Host "URL: https://attendance.ai-asaas.com" -ForegroundColor Cyan
