<#
.SYNOPSIS
    Registers or updates the ASAS Attendance Watchdog boot task in Windows Task Scheduler.
.DESCRIPTION
    Configures the ASAS attendance watchdog to run automatically at system startup under
    NT AUTHORITY\SYSTEM in Session 0, independent of interactive user login sessions,
    with elevated privileges and automatic recovery on failure.
    Also handles clean uninstallation via -Uninstall and disables conflicting legacy
    interactive user startup scripts.
.PARAMETER Uninstall
    Stops and unregisters the scheduled task, and terminates running watchdog instances.
.PARAMETER TaskName
    Name of the scheduled task (default: 'ASAS Attendance Watchdog').
.PARAMETER Start
    Immediately starts the scheduled task after registration.
.PARAMETER cli
    Runs in non-interactive CLI mode.
.EXAMPLE
    .\register-auto-start.ps1
.EXAMPLE
    .\register-auto-start.ps1 -Uninstall
#>
[CmdletBinding()]
param (
    [switch]$Uninstall = $false,
    [string]$TaskName = "ASAS Attendance Watchdog",
    [switch]$Start = $false,
    [switch]$cli = $false
)

# -------------------------------------------------------------
# 0. Administrator Self-Elevation Guard
# -------------------------------------------------------------
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[!] Administrative privileges required. Elevating to Administrator..." -ForegroundColor Yellow
    $tempLog = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "asas_register_$([Guid]::NewGuid().ToString('N')).log")
    $elevatedCommand = "& '$PSCommandPath'"
    if ($Uninstall) { $elevatedCommand += " -Uninstall" }
    if ($TaskName) { $elevatedCommand += " -TaskName '$TaskName'" }
    if ($Start) { $elevatedCommand += " -Start" }
    if ($cli) { $elevatedCommand += " -cli" }
    $elevatedCommand += " *>&1 | Out-File -FilePath '$tempLog' -Encoding UTF8 -Width 4096; exit `$LASTEXITCODE"
    
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $elevatedCommand) -Verb RunAs -PassThru -Wait
    if (Test-Path $tempLog) {
        Get-Content -Path $tempLog
        Remove-Item -Path $tempLog -Force -ErrorAction SilentlyContinue
    }
    exit $proc.ExitCode
}

# -------------------------------------------------------------
# 1. Directory and Path Resolution
# -------------------------------------------------------------
$BaseDir = "C:\Users\Anoos.alaghbari\attendance"
if (-not (Test-Path $BaseDir)) {
    $BaseDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}
$ScriptPath = Join-Path $BaseDir "scripts\windows\asas-watchdog.ps1"
$legacyStartup = "C:\Users\Anoos.alaghbari\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\start-asas-attendance.vbs"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ASAS Attendance System - Server Boot Auto-Start Setup        " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# -------------------------------------------------------------
# 2. Handle Clean Uninstallation (-Uninstall)
# -------------------------------------------------------------
if ($Uninstall) {
    Write-Host "[-] Processing uninstallation request for task: '$TaskName'..." -ForegroundColor Cyan
    
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "    Stopping scheduled task '$TaskName'..." -ForegroundColor Gray
        try {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        } catch {}
        
        Write-Host "    Unregistering scheduled task '$TaskName'..." -ForegroundColor Gray
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Host "[OK] Task '$TaskName' successfully unregistered." -ForegroundColor Green
        } catch {
            Write-Error "Failed to unregister scheduled task: $($_.Exception.Message)"
            exit 1
        }
    } else {
        Write-Host "[*] Scheduled task '$TaskName' is not registered. Nothing to unregister." -ForegroundColor Gray
    }

    # Stop any running watchdog instances
    $runningProcs = Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -match "asas-watchdog.ps1" -and $_.CommandLine -match "-Continuous"
    }
    if ($runningProcs) {
        Write-Host "    Terminating active watchdog process(es)..." -ForegroundColor Cyan
        foreach ($p in $runningProcs) {
            try {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "    [OK] Stopped process PID $($p.ProcessId) (Session $($p.SessionId))." -ForegroundColor Gray
            } catch {}
        }
    }
    
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  Uninstallation complete. Auto-start removed.                 " -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Cyan
    exit 0
}

# -------------------------------------------------------------
# 3. Prerequisites Validation
# -------------------------------------------------------------
if (-not (Test-Path $ScriptPath)) {
    Write-Error "Target watchdog script not found at: $ScriptPath"
    exit 1
}

Write-Host "[*] Target Watchdog Script: $ScriptPath" -ForegroundColor Gray
Write-Host "[*] Working Directory:      $BaseDir" -ForegroundColor Gray
Write-Host "[*] Target Scheduled Task:  $TaskName" -ForegroundColor Gray

# -------------------------------------------------------------
# 4. Construct Task Definition Components
# -------------------------------------------------------------
Write-Host "[*] Defining Scheduled Task parameters..." -ForegroundColor Cyan

# Action: powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<ScriptPath>" -Continuous
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`" -Continuous" `
    -WorkingDirectory $BaseDir

# Trigger: AtStartup (BootTrigger - fires at boot before any user login)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Principal: NT AUTHORITY\SYSTEM (SID S-1-5-18), Highest available privileges, ServiceAccount
$Principal = New-ScheduledTaskPrincipal `
    -UserId "NT AUTHORITY\SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Settings:
# - ExecutionTimeLimit: PT0S (0 days/hours/seconds = Infinite, no 72-hour cutoff)
# - RestartCount: 5 (auto-recovery on crash)
# - RestartInterval: 1 minute (PT1M)
# - MultipleInstances: IgnoreNew
# - AllowStartIfOnBatteries, DontStopIfGoingOnBatteries
# - StartWhenAvailable
# - Priority: 4
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -Priority 4

# -------------------------------------------------------------
# 5. Idempotent Task Registration
# -------------------------------------------------------------
Write-Host "[*] Registering task in Windows Task Scheduler..." -ForegroundColor Cyan
try {
    $task = Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description "ASAS Attendance System 24/7 Automated Watchdog & Self-Healing Service (Server Reboot Auto-Start)" `
        -Force
    
    if (-not $task) {
        throw "Register-ScheduledTask returned null."
    }
    Write-Host "[OK] Scheduled task '$TaskName' successfully registered/updated." -ForegroundColor Green
    Write-Host "     - Trigger:   AtStartup (BootTrigger - before user logon)" -ForegroundColor Gray
    Write-Host "     - Principal: NT AUTHORITY\SYSTEM (Session 0, Highest RunLevel)" -ForegroundColor Gray
    Write-Host "     - Timeout:   PT0S (Indefinite continuous execution)" -ForegroundColor Gray
    Write-Host "     - Recovery:  5 restarts every 1 minute on failure" -ForegroundColor Gray
} catch {
    Write-Error "Failed to register scheduled task: $($_.Exception.Message)"
    exit 1
}

# -------------------------------------------------------------
# 6. Mitigate Legacy Interactive Startup Conflict
# -------------------------------------------------------------
# In Windows, Local\ mutex is session-isolated. To avoid duplicate watchdog
# instances competing for ports when user Anoos logs in interactively,
# disable the legacy shortcut in AppData\Roaming\...\Startup.
if (Test-Path $legacyStartup) {
    $disabledPath = "$legacyStartup.disabled"
    try {
        Move-Item -Path $legacyStartup -Destination $disabledPath -Force
        Write-Host "[OK] Disabled legacy user startup shortcut to prevent session mutex conflict." -ForegroundColor Green
        Write-Host "     Moved to: $disabledPath" -ForegroundColor Gray
    } catch {
        Write-Warning "Failed to disable legacy user startup shortcut: $($_.Exception.Message)"
    }
} else {
    Write-Host "[*] No active legacy user startup shortcut found (already disabled or absent)." -ForegroundColor Gray
}

# -------------------------------------------------------------
# 7. Terminate Any Running Interactive Watchdog Process
# -------------------------------------------------------------
$interactiveProcs = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "asas-watchdog.ps1" -and $_.SessionId -ne 0
}
if ($interactiveProcs) {
    Write-Host "[*] Terminating legacy interactive watchdog processes (SessionId != 0)..." -ForegroundColor Cyan
    foreach ($proc in $interactiveProcs) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "    [OK] Terminated interactive watchdog PID $($proc.ProcessId) (Session $($proc.SessionId))." -ForegroundColor Gray
        } catch {}
    }
}

# -------------------------------------------------------------
# 8. Optional Immediate Start
# -------------------------------------------------------------
if ($Start) {
    Write-Host "[*] Starting Scheduled Task '$TaskName'..." -ForegroundColor Cyan
    try {
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "[OK] Task started successfully." -ForegroundColor Green
    } catch {
        Write-Error "Failed to start scheduled task: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Auto-Start Registration COMPLETE (Idempotent: Safe to Re-run) " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
exit 0
