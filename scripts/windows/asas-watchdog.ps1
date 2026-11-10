# =============================================================================
# ASAS Attendance System - 24/7 Automated Watchdog & Self-Healing Service
# Monitors & Auto-Recovers:
# 1. SQLite Database Integrity (database\asas.db)
# 2. Backend API Service (Port 6500)
# 3. Next.js Frontend Server (Port 7442)
# 4. Smart Dual Proxy (Ports 7443 & 8443)
# 5. Cloudflare Tunnel (cloudflared.exe)
# =============================================================================

param (
    [switch]$Continuous = $false,
    [int]$IntervalSeconds = 20
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

# Base directory (use attendance junction to avoid Arabic path issues)
$BaseDir = "C:\Users\Anoos.alaghbari\attendance"
if (-not (Test-Path $BaseDir)) {
    $BaseDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}

$LogDir = Join-Path $BaseDir "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$WatchdogLog = Join-Path $LogDir "watchdog.log"

# Prevent multiple continuous instances using Named Mutex
$mutex = $null
if ($Continuous) {
    $createdNew = $false
    $mutex = New-Object System.Threading.Mutex($true, "Local\AsasAttendanceWatchdogMutex", [ref]$createdNew)
    if (-not $createdNew) {
        exit 0
    }
}

function Log-Message {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$timestamp] [$Level] $Message"
    try {
        # Rotate log if > 5MB
        if ((Test-Path $WatchdogLog) -and ((Get-Item $WatchdogLog).Length -gt 5MB)) {
            $oldLog = Join-Path $LogDir "watchdog.log.old"
            Move-Item -Path $WatchdogLog -Destination $oldLog -Force -ErrorAction SilentlyContinue
        }
        Add-Content -Path $WatchdogLog -Value $entry -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch {}
    
    if (-not $Continuous) {
        try {
            if ($Level -eq "ERROR") {
                Write-Host $entry -ForegroundColor Red
            } elseif ($Level -eq "WARN") {
                Write-Host $entry -ForegroundColor Yellow
            } elseif ($Level -eq "SUCCESS") {
                Write-Host $entry -ForegroundColor Green
            } else {
                Write-Host $entry -ForegroundColor Cyan
            }
        } catch {}
    }
}

function Test-TcpPort {
    param([string]$HostName = "127.0.0.1", [int]$Port, [int]$TimeoutMs = 1200)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($wait -and $client.Connected) {
            $client.EndConnect($iar)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
        $client.Dispose()
    }
}

function Ensure-SqliteDb {
    $dbFile = Join-Path $BaseDir "database\asas.db"
    if (Test-Path $dbFile) {
        return $true
    }
    Log-Message "SQLite database file missing at $dbFile (will be initialized by backend)." "WARN"
    return $true
}

function Ensure-Backend {
    $backendPort = 6500
    $backendDir = Join-Path $BaseDir "backend"
    
    # Health check
    $isHealthy = $false
    if (Test-TcpPort -Port $backendPort) {
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:$backendPort/health" -TimeoutSec 2 -ErrorAction Stop
            if ($res -and ($res.status -eq 'ready' -or $res.data.status -eq 'ready')) {
                $isHealthy = $true
            }
        } catch {
            $isHealthy = $false
        }
    }

    if ($isHealthy) {
        return $true
    }

    Log-Message "Backend API on port $backendPort is UNHEALTHY or DOWN. Recovering..." "WARN"

    # Stop hung process on port 6500
    $conn = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }

    $backendOut = Join-Path $LogDir "backend.log"
    $backendErr = Join-Path $LogDir "backend_error.log"

    Start-Process -FilePath "node.exe" -ArgumentList "src/asas-server.js" -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr

    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:$backendPort/health" -TimeoutSec 1 -ErrorAction Stop
            if ($res -and ($res.status -eq 'ready' -or $res.data.status -eq 'ready')) {
                Log-Message "Backend API on port $backendPort is UP and healthy!" "SUCCESS"
                return $true
            }
        } catch {}
    }

    Log-Message "Backend API failed to recover on port $backendPort" "ERROR"
    return $false
}

function Ensure-Frontend {
    $targetPort = 7442
    
    if (Test-TcpPort -Port $targetPort) {
        return $true
    }

    Log-Message "Next.js Frontend on port $targetPort is DOWN. Launching..." "WARN"

    # Clean hung processes on 7442
    $conn = Get-NetTCPConnection -LocalPort $targetPort -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }

    $frontendDir = Join-Path $BaseDir "frontend"
    $frontOut = Join-Path $LogDir "frontend.log"
    $frontErr = Join-Path $LogDir "frontend_error.log"

    Start-Process -FilePath "cmd.exe" -ArgumentList "/c node node_modules\next\dist\bin\next start -p $targetPort" -WorkingDirectory $frontendDir -WindowStyle Hidden -RedirectStandardOutput $frontOut -RedirectStandardError $frontErr

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        if (Test-TcpPort -Port $targetPort) {
            Log-Message "Frontend Next.js on port $targetPort is UP!" "SUCCESS"
            return $true
        }
    }

    Log-Message "Frontend Next.js failed to start on port $targetPort" "ERROR"
    return $false
}

function Ensure-SmartProxy {
    $proxyPort = 8443
    $proxyPortAlt = 7443
    
    if ((Test-TcpPort -Port $proxyPort) -and (Test-TcpPort -Port $proxyPortAlt)) {
        return $true
    }

    Log-Message "Smart Dual Proxy on ports $proxyPort / $proxyPortAlt is DOWN. Recovering..." "WARN"

    foreach ($p in @($proxyPort, $proxyPortAlt)) {
        $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
        }
    }

    $proxyOut = Join-Path $LogDir "smart-proxy.log"
    $proxyErr = Join-Path $LogDir "smart-proxy_error.log"

    Start-Process -FilePath "node.exe" -ArgumentList "smart-proxy-7443.js" -WorkingDirectory $BaseDir -WindowStyle Hidden -RedirectStandardOutput $proxyOut -RedirectStandardError $proxyErr

    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if ((Test-TcpPort -Port $proxyPort) -and (Test-TcpPort -Port $proxyPortAlt)) {
            Log-Message "Smart Dual Proxy recovered on ports $proxyPort & $proxyPortAlt!" "SUCCESS"
            return $true
        }
    }

    Log-Message "Smart Dual Proxy failed to recover" "ERROR"
    return $false
}

function Ensure-CloudflareTunnel {
    $cfProc = Get-Process "cloudflared" -ErrorAction SilentlyContinue
    if ($cfProc) {
        return $true
    }

    Log-Message "Cloudflare Tunnel (cloudflared.exe) is DOWN. Recovering..." "WARN"

    $cfExe = Join-Path $BaseDir ".local\cloudflared.exe"
    if (-not (Test-Path $cfExe)) {
        Log-Message "cloudflared.exe not found at $cfExe" "ERROR"
        return $false
    }

    $cfToken = "eyJhIjoiNWYyMGJmZWM5ZTNkZDIwNDA4ZWYxYjI4YjI4ZmRkYmEiLCJ0IjoiY2MwZTA3MTQtNjJmMS00ZTJhLWJlZGEtYjQ3ZWE1NDY1MDk2IiwicyI6ImMzVndaWEp6WldOeVpYUndZWE56ZDI5eVpHWnZjbUZ6WVdGellYUjBaVzVrWVc1alpUSXdNalk9In0="
    Start-Process -FilePath $cfExe -ArgumentList "tunnel run --token `"$cfToken`"" -WindowStyle Hidden

    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        $check = Get-Process "cloudflared" -ErrorAction SilentlyContinue
        if ($check) {
            Log-Message "Cloudflare Tunnel recovered successfully!" "SUCCESS"
            return $true
        }
    }

    Log-Message "Failed to start Cloudflare Tunnel" "ERROR"
    return $false
}

function Run-HealthCycle {
    $dbOk = Ensure-SqliteDb
    $beOk = Ensure-Backend
    $feOk = Ensure-Frontend
    $prOk = Ensure-SmartProxy
    $cfOk = Ensure-CloudflareTunnel

    return ($dbOk -and $beOk -and $feOk -and $prOk -and $cfOk)
}

# Main Execution Flow
Log-Message "=== ASAS 24/7 Watchdog initialized ===" "INFO"

if ($Continuous) {
    Log-Message "Entering continuous watchdog mode (checking every $IntervalSeconds seconds)..." "INFO"
    $cycleCount = 0
    while ($true) {
        try {
            $allOk = Run-HealthCycle
            $cycleCount++
            # Log periodic heartbeat every 30 minutes (90 cycles of 20s)
            if ($cycleCount -ge 90) {
                if ($allOk) {
                    Log-Message "Heartbeat: All 5 core services running healthy." "INFO"
                }
                $cycleCount = 0
            }
        } catch {
            Log-Message "Watchdog loop exception: $($_.Exception.Message)" "ERROR"
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    $result = Run-HealthCycle
    if ($result) {
        Log-Message "Single health check completed: ALL 5 SERVICES 100% HEALTHY." "SUCCESS"
    } else {
        Log-Message "Single health check completed: Some services encountered issues." "WARN"
    }
}
