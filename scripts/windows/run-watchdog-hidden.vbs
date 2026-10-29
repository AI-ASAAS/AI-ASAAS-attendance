' ASAS Attendance System - Silent Watchdog Launcher
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = scriptDir & "\asas-watchdog.ps1"

' Check if watchdog is already running to prevent duplicates
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%asas-watchdog.ps1%Continuous%'")

If colProcesses.Count = 0 Then
    cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psScript & """ -Continuous"
    WshShell.Run cmd, 0, False
End If
