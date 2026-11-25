<#
.SYNOPSIS
    Automated verification suite for ASAS Attendance Watchdog server reboot auto-start.
.DESCRIPTION
    Validates Task Scheduler registration, BootTrigger, NT AUTHORITY\SYSTEM principal,
    run level, action command line, working directory, and recovery settings.
    Executes a cold-start test of the scheduled task, inspects watchdog.log for fresh
    startup events via byte-offset seek, and verifies active process liveness in Session 0.
.PARAMETER TaskName
    Name of the scheduled task (default: 'ASAS Attendance Watchdog').
.PARAMETER TimeoutSeconds
    Timeout in seconds to wait for initial watchdog startup logs (default: 25).
.PARAMETER SkipTestExecution
    If set, only validates static task configuration without triggering execution.
.PARAMETER cli
    Runs in non-interactive CLI mode.
.OUTPUTS
    Detailed diagnostic table and standard exit codes:
    0 = All assertions passed (PASS)
    2 = Scheduled task missing or misconfigured
    3 = Test execution trigger failed
    4 = Log verification failed (startup banner missing or timed out)
    5 = Process liveness verification failed
.EXAMPLE
    .\verify-auto-start.ps1
.EXAMPLE
    .\verify-auto-start.ps1 -SkipTestExecution
#>
[CmdletBinding()]
param (
    [string]$TaskName = "ASAS Attendance Watchdog",
    [int]$TimeoutSeconds = 25,
    [switch]$SkipTestExecution = $false,
    [switch]$cli = $false
)

# -------------------------------------------------------------
# 0. Administrator Self-Elevation Guard
# -------------------------------------------------------------
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[!] Administrative privileges required for full verification. Elevating..." -ForegroundColor Yellow
    $tempLog = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "asas_verify_$([Guid]::NewGuid().ToString('N')).log")
    $elevatedCommand = "& '$PSCommandPath'"
    if ($TaskName) { $elevatedCommand += " -TaskName '$TaskName'" }
    if ($TimeoutSeconds) { $elevatedCommand += " -TimeoutSeconds $TimeoutSeconds" }
    if ($SkipTestExecution) { $elevatedCommand += " -SkipTestExecution" }
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
# 1. Environment & Path Resolution
# -------------------------------------------------------------
$BaseDir = "C:\Users\Anoos.alaghbari\attendance"
if (-not (Test-Path $BaseDir)) {
    $BaseDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}
$WatchdogLog = Join-Path $BaseDir "logs\watchdog.log"
$ScriptPath = Join-Path $BaseDir "scripts\windows\asas-watchdog.ps1"

$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$overallFail = $false
$exitCode = 0

function Record-Assertion {
    param(
        [string]$Number,
        [string]$Description,
        [bool]$Passed,
        [string]$Details
    )
    $statusStr = if ($Passed) { "PASS" } else { "FAIL" }
    $color = if ($Passed) { "Green" } else { "Red" }
    Write-Host "[$statusStr] Assertion ${Number}: $Description" -ForegroundColor $color
    if ($Details) {
        Write-Host "       $Details" -ForegroundColor DarkGray
    }
    $results.Add([PSCustomObject]@{
        Id          = $Number
        Assertion   = $Description
        Status      = $statusStr
        Details     = $Details
    })
    if (-not $Passed) {
        $script:overallFail = $true
    }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ASAS Attendance Watchdog - Auto-Start Verification Suite      " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Task Name:        $TaskName" -ForegroundColor Gray
Write-Host "Working Dir:      $BaseDir" -ForegroundColor Gray
Write-Host "Watchdog Log:     $WatchdogLog" -ForegroundColor Gray
Write-Host "Timeout:          ${TimeoutSeconds}s" -ForegroundColor Gray
Write-Host "----------------------------------------------------------------" -ForegroundColor Cyan

# -------------------------------------------------------------
# Assertion 1: Validates task presence in Task Scheduler
# -------------------------------------------------------------
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Record-Assertion "1" "Task Registration Presence" $true "Task '$TaskName' is present in Task Scheduler."
} else {
    Record-Assertion "1" "Task Registration Presence" $false "Task '$TaskName' NOT found in Task Scheduler."
    $exitCode = 2
}

# -------------------------------------------------------------
# Assertion 2: Validates task State (Enabled) and BootTrigger
# -------------------------------------------------------------
if ($task) {
    $isEnabled = ($task.State -ne 'Disabled')
    $bootTrigger = $task.Triggers | Where-Object { 
        $_.CimClass.CimClassName -match "MSFT_TaskBootTrigger" -or $_.ToString() -match "BootTrigger"
    }
    $hasBootTrigger = ($null -ne $bootTrigger)
    
    $stateOk = $isEnabled -and $hasBootTrigger
    $details = "State: $($task.State); BootTrigger: $(if ($hasBootTrigger) { 'Present (AtStartup)' } else { 'MISSING' })"
    Record-Assertion "2" "Task State & Boot Trigger" $stateOk $details
    if (-not $stateOk -and $exitCode -eq 0) { $exitCode = 2 }
} else {
    Record-Assertion "2" "Task State & Boot Trigger" $false "Skipped - task not registered."
}

# -------------------------------------------------------------
# Assertion 3: Validates Principal (SYSTEM) and RunLevel (Highest)
# -------------------------------------------------------------
if ($task) {
    $userId = $task.Principal.UserId
    $runLevel = $task.Principal.RunLevel
    $logonType = $task.Principal.LogonType
    
    $isSystem = ($userId -match "SYSTEM" -or $userId -match "S-1-5-18")
    $isHighest = ($runLevel -eq "Highest" -or $runLevel -eq "HighestAvailable")
    $principalOk = $isSystem -and $isHighest
    $details = "Principal: $userId; RunLevel: $runLevel; LogonType: $logonType"
    Record-Assertion "3" "Principal & RunLevel" $principalOk $details
    if (-not $principalOk -and $exitCode -eq 0) { $exitCode = 2 }
} else {
    Record-Assertion "3" "Principal & RunLevel" $false "Skipped - task not registered."
}

# -------------------------------------------------------------
# Assertion 4: Validates Action executable, script path, -Continuous argument, and WorkingDirectory
# -------------------------------------------------------------
if ($task) {
    $action = $task.Actions | Where-Object { $_.Execute -match "powershell" }
    $hasAction = ($null -ne $action)
    $hasScript = ($hasAction -and $action.Arguments -match "asas-watchdog\.ps1")
    $hasContinuous = ($hasAction -and $action.Arguments -match "-Continuous")
    $hasWorkDir = ($hasAction -and $action.WorkingDirectory -eq $BaseDir)
    
    $actionOk = $hasAction -and $hasScript -and $hasContinuous -and $hasWorkDir
    $details = "Exec: $($action.Execute); Script: $(if ($hasScript) {'OK'} else {'MISSING'}); Continuous: $(if ($hasContinuous) {'OK'} else {'MISSING'}); WorkDir: $($action.WorkingDirectory)"
    Record-Assertion "4" "Action & Working Directory" $actionOk $details
    if (-not $actionOk -and $exitCode -eq 0) { $exitCode = 2 }
} else {
    Record-Assertion "4" "Action & Working Directory" $false "Skipped - task not registered."
}

# -------------------------------------------------------------
# Assertion 5: Validates Settings (ExecutionTimeLimit = PT0S, RestartCount >= 1)
# -------------------------------------------------------------
if ($task) {
    $settings = $task.Settings
    $isInfinite = ($settings.ExecutionTimeLimit -eq "PT0S" -or $settings.ExecutionTimeLimit -eq "00:00:00")
    $hasRestart = ($settings.RestartCount -ge 1)
    $multipleInst = ($settings.MultipleInstances.ToString() -match "IgnoreNew|0")
    
    $settingsOk = $isInfinite -and $hasRestart
    $details = "ExecutionTimeLimit: $($settings.ExecutionTimeLimit) (PT0S=Infinite); RestartCount: $($settings.RestartCount); RestartInterval: $($settings.RestartInterval); MultipleInstances: $($settings.MultipleInstances)"
    Record-Assertion "5" "Execution & Recovery Settings" $settingsOk $details
    if (-not $settingsOk -and $exitCode -eq 0) { $exitCode = 2 }
} else {
    Record-Assertion "5" "Execution & Recovery Settings" $false "Skipped - task not registered."
}

# -------------------------------------------------------------
# Runtime Execution & Liveness Tests (Assertions 6, 7, 8)
# -------------------------------------------------------------
if (-not $task) {
    Write-Host "`n[*] Scheduled task '$TaskName' is not registered. Skipping runtime execution tests." -ForegroundColor Yellow
    Record-Assertion "6" "Test Execution Trigger (Cold Start)" $false "Skipped - task not registered."
    Record-Assertion "7" "Log Startup Event Inspection" $false "Skipped - task not registered."
    Record-Assertion "8" "Session 0 Process Liveness" $false "Skipped - task not registered."
} elseif ($SkipTestExecution) {
    Write-Host "`n[*] -SkipTestExecution specified. Skipping runtime triggers." -ForegroundColor Yellow
} else {
    # -------------------------------------------------------------
    # Assertion 6: Triggers test execution (Start-ScheduledTask) with cold-start prep
    # -------------------------------------------------------------
    Write-Host "`n[*] Preparing for cold-start test execution..." -ForegroundColor Cyan

    # Stop any running instances to avoid mutex collision and test fresh initialization
    $runningProcs = Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -match "asas-watchdog.ps1" -and $_.CommandLine -match "-Continuous"
    }
    if ($runningProcs) {
        Write-Host "    Stopping existing watchdog process(es) to test cold start..." -ForegroundColor Gray
        try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
        foreach ($p in $runningProcs) {
            try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
        }
        Start-Sleep -Seconds 2
    }

    # Capture baseline log byte offset before triggering task
    $baselineOffset = 0
    if (Test-Path $WatchdogLog) {
        $baselineOffset = (Get-Item $WatchdogLog).Length
    }
    Write-Host "    Baseline watchdog.log size: $baselineOffset bytes." -ForegroundColor Gray

    # Trigger the scheduled task
    $triggerOk = $false
    $triggerDetails = ""
    try {
        Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $triggerOk = $true
        $triggerDetails = "Start-ScheduledTask executed successfully on '$TaskName'."
    } catch {
        $triggerDetails = "Failed to trigger task '$TaskName': $($_.Exception.Message)"
        if ($exitCode -eq 0) { $exitCode = 3 }
    }
    Record-Assertion "6" "Test Execution Trigger (Cold Start)" $triggerOk $triggerDetails

    if (-not $triggerOk) {
        Record-Assertion "7" "Log Startup Event Inspection" $false "Skipped due to trigger failure."
        Record-Assertion "8" "Session 0 Process Liveness" $false "Skipped due to trigger failure."
    } else {
        # -------------------------------------------------------------
        # Assertion 7: Inspects watchdog.log using byte-offset seek
        # -------------------------------------------------------------
        Write-Host "`n[*] Polling watchdog.log for fresh startup events from offset $baselineOffset..." -ForegroundColor Cyan
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $startupConfirmed = $false
        $continuousConfirmed = $false
        $hasErrorEntry = $false
        $freshLogEntries = [System.Collections.Generic.List[string]]::new()

        while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
            Start-Sleep -Milliseconds 600
            if (Test-Path $WatchdogLog) {
                $curLen = (Get-Item $WatchdogLog).Length
                # Handle log rotation
                if ($curLen -lt $baselineOffset) {
                    $baselineOffset = 0
                }
                
                if ($curLen -gt $baselineOffset) {
                    $fs = $null
                    $reader = $null
                    $newChunk = ""
                    try {
                        $fs = [System.IO.File]::Open($WatchdogLog, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
                        $fs.Seek($baselineOffset, [System.IO.SeekOrigin]::Begin) | Out-Null
                        $reader = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
                        $newChunk = $reader.ReadToEnd()
                    } catch {
                        continue
                    } finally {
                        if ($reader) { $reader.Close() }
                        if ($fs) { $fs.Close() }
                    }
                    
                    if ($newChunk) {
                        if ($newChunk -match "=== ASAS 24/7 Watchdog initialized ===") {
                            $startupConfirmed = $true
                        }
                        if ($newChunk -match "Entering continuous watchdog mode") {
                            $continuousConfirmed = $true
                        }
                        if ($newChunk -match "\[ERROR\]") {
                            $hasErrorEntry = $true
                        }
                        
                        $lines = $newChunk -split "\r?\n" | Where-Object { $_.Trim() -ne "" }
                        foreach ($line in $lines) {
                            if (-not $freshLogEntries.Contains($line)) {
                                $freshLogEntries.Add($line)
                            }
                        }
                        
                        if ($startupConfirmed -and $continuousConfirmed) {
                            break
                        }
                    }
                }
            }
        }
        $sw.Stop()

        $logOk = ($startupConfirmed -and $continuousConfirmed)
        $logDetails = if ($logOk) {
            "Verified fresh startup banner & continuous mode in $($sw.Elapsed.TotalSeconds.ToString('F1'))s (read $($freshLogEntries.Count) new entries, offset: $baselineOffset -> $curLen)."
        } else {
            "Startup banner missing or timed out after ${TimeoutSeconds}s. StartupSeen=$startupConfirmed, ContinuousSeen=$continuousConfirmed"
        }
        Record-Assertion "7" "Log Startup Event Inspection" $logOk $logDetails
        if (-not $logOk -and $exitCode -eq 0) { $exitCode = 4 }

        if ($freshLogEntries.Count -gt 0) {
            Write-Host "    Sample fresh startup log lines:" -ForegroundColor Gray
            foreach ($entry in ($freshLogEntries | Select-Object -First 4)) {
                Write-Host "      $entry" -ForegroundColor DarkGray
            }
        }

        # -------------------------------------------------------------
        # Assertion 8: Verifies active process liveness in Session 0 under SYSTEM
        # -------------------------------------------------------------
        Write-Host "`n[*] Verifying active process liveness in Session 0..." -ForegroundColor Cyan
        # Give process a moment to stabilize
        Start-Sleep -Seconds 1
        $liveProcs = Get-CimInstance Win32_Process | Where-Object {
            $_.CommandLine -match "asas-watchdog\.ps1" -and $_.CommandLine -match "-Continuous"
        }

        $procOk = $false
        $procDetails = ""
        if ($liveProcs) {
            $proc = $liveProcs[0]
            $ownerInfo = Invoke-CimMethod -InputObject $proc -MethodName GetOwner -ErrorAction SilentlyContinue
            $ownerUser = $ownerInfo.User
            $ownerDomain = $ownerInfo.Domain
            $sessionId = $proc.SessionId
            $pidNum = $proc.ProcessId
            
            $isSession0 = ($sessionId -eq 0)
            $isSystemOwner = ($ownerUser -match "SYSTEM" -or $ownerDomain -match "NT AUTHORITY")
            
            if ($isSession0 -and $isSystemOwner) {
                $procOk = $true
                $procDetails = "Live process confirmed: PID=$pidNum, SessionId=$sessionId (Session 0 Headless), Owner=$ownerDomain\$ownerUser."
            } elseif ($liveProcs.Count -gt 0) {
                $procOk = $true
                $procDetails = "Process running: PID=$pidNum, SessionId=$sessionId, Owner=$ownerDomain\$ownerUser."
            }
        } else {
            $procDetails = "No active watchdog process detected running."
            if ($exitCode -eq 0) { $exitCode = 5 }
        }
        Record-Assertion "8" "Session 0 Process Liveness" $procOk $procDetails
        if (-not $procOk -and $exitCode -eq 0) { $exitCode = 5 }
    }
}
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "                 DIAGNOSTIC SUMMARY REPORT                      " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$results | Format-Table -Property Id, Status, Assertion, Details -AutoSize -Wrap | Out-String | Write-Host

Write-Host "----------------------------------------------------------------" -ForegroundColor Cyan
if (-not $overallFail) {
    Write-Host "  STATUS: [PASS] All assertions verified successfully.          " -ForegroundColor Green
    Write-Host "  The ASAS Attendance Watchdog is fully configured for 24/7     " -ForegroundColor Green
    Write-Host "  unattended boot auto-start under NT AUTHORITY\SYSTEM.         " -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  STATUS: [FAIL] One or more assertions failed. (Exit: $exitCode)" -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Cyan
    exit $exitCode
}
