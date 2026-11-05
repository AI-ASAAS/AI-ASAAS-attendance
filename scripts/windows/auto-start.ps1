# Auto-start ASAS Attendance 24/7 Watchdog on user logon
$silentBat = "C:\Users\Anoos.alaghbari\attendance\scripts\windows\run-watchdog-silent.bat"
if (Test-Path $silentBat) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$silentBat`"" -WindowStyle Hidden
} else {
    $psScript = "C:\Users\Anoos.alaghbari\attendance\scripts\windows\asas-watchdog.ps1"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$psScript`" -Continuous" -WindowStyle Hidden
}
