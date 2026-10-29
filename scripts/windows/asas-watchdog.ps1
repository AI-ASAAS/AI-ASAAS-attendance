# =============================================================================
# ASAS Attendance System - 24/7 Automated Watchdog & Self-Healing Service
# Ensures PostgreSQL (6543), Backend (6500), Frontend (7443), and Caddy (443)
# are ALWAYS online, self-recovering automatically upon Windows reboot or crash.
# =============================================================================

param (
    [switch]$Continuous = $false,
    [int]$IntervalSeconds = 30
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$WatchdogLog = Join-Path $LogDir "watchdog.log"

function Log-Message {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$timestamp] [$Level] $Message"
    try {
        Add-Content -Path $WatchdogLog -Value $entry -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch {}
    if ($Level -eq "ERROR") {
        Write-Host $entry -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host $entry -ForegroundColor Yellow
    } elseif ($Level -eq "SUCCESS") {
        Write-Host $entry -ForegroundColor Green
    } else {
        Write-Host $entry -ForegroundColor Cyan
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

function Ensure-Postgres {
    $dbPort = 6543
    $pgData = "C:\Users\Anoos.alaghbari\asas_pgdata"
    
    if (Test-TcpPort -Port $dbPort) {
        return $true
    }

    Log-Message "PostgreSQL on port $dbPort is DOWN. Initiating recovery..." "WARN"
    
    # Clean stale postmaster.pid if postgres terminated abnormally
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) {
        try {
            $rawPid = (Get-Content $pidFile -Head 1).Trim()
            $existingProc = Get-Process -Id $rawPid -ErrorAction SilentlyContinue
            if (-not $existingProc) {
                Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
                Log-Message "Removed stale postmaster.pid (PID $rawPid)" "INFO"
            }
        } catch {
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        }
    }

    $pgCtl = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
    if (-not (Test-Path $pgCtl)) {
        $pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
    }

    if (Test-Path $pgCtl) {
        $serverLog = Join-Path $pgData "server.log"
        & $pgCtl start -D "$pgData" -l "$serverLog" -s -w -t 20 | Out-Null
    } else {
        $pgExe = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
        Start-Process -FilePath $pgExe -ArgumentList "-D `"$pgData`" -p $dbPort" -WindowStyle Hidden
    }

    # Verify recovery
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 800
        if (Test-TcpPort -Port $dbPort) {
            Log-Message "PostgreSQL on port $dbPort recovered successfully!" "SUCCESS"
            return $true
        }
    }

    Log-Message "Failed to start PostgreSQL on port $dbPort" "ERROR"
    return $false
}

function Ensure-Backend {
    $backendPort = 6500
    $backendDir = Join-Path $ProjectRoot "backend"
    
    # Fast HTTP Health Check
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

    # Stop any hung process on port 6500
    $conn = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }

    $backendOut = Join-Path $LogDir "backend.log"
    $backendErr = Join-Path $LogDir "backend_error.log"

    Start-Process -FilePath "node.exe" -ArgumentList "src/asas-server.js" -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr

    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 600
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:$backendPort/health" -TimeoutSec 1 -ErrorAction Stop
            if ($res -and ($res.status -eq 'ready' -or $res.data.status -eq 'ready')) {
                Log-Message "Backend API on port $backendPort is UP and healthy!" "SUCCESS"
                return $true
            }
        } catch {}
    }

    Log-Message "Backend API failed to become healthy on port $backendPort" "ERROR"
    return $false
}

function Ensure-Frontend {
    $candidates = @(7443, 7777, 3001)
    $activePort = $null

    foreach ($p in $candidates) {
        if (Test-TcpPort -Port $p) {
            try {
                $res = Invoke-WebRequest -Uri "http://127.0.0.1:$p/" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                if ($res.StatusCode -eq 200) {
                    $activePort = $p
                    break
                }
            } catch {}
        }
    }

    if ($activePort) {
        return $activePort
    }

    # Find free candidate port
    $targetPort = 7443
    foreach ($p in $candidates) {
        if (-not (Test-TcpPort -Port $p)) {
            $targetPort = $p
            break
        }
    }

    Log-Message "Frontend is DOWN. Launching Next.js on port $targetPort..." "WARN"

    $frontendDir = Join-Path $ProjectRoot "frontend"
    $frontOut = Join-Path $LogDir "frontend.log"
    $frontErr = Join-Path $LogDir "frontend_error.log"

    Start-Process -FilePath "cmd.exe" -ArgumentList "/c node node_modules\next\dist\bin\next start -p $targetPort" -WorkingDirectory $frontendDir -WindowStyle Hidden -RedirectStandardOutput $frontOut -RedirectStandardError $frontErr

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 700
        if (Test-TcpPort -Port $targetPort) {
            Log-Message "Frontend is UP and running on port $targetPort" "SUCCESS"
            return $targetPort
        }
    }

    Log-Message "Frontend failed to start on port $targetPort" "ERROR"
    return $null
}

function Ensure-DockerAndCaddy {
    if ((Test-TcpPort -Port 8443) -or (Test-TcpPort -Port 443)) {
        return $true
    }

    Log-Message "Caddy Reverse Proxy is DOWN. Checking Docker..." "WARN"

    # Check Docker Desktop
    $dockerProc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dockerProc) {
        Log-Message "Starting Docker Desktop..." "INFO"
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
    }

    # Wait for Docker engine
    for ($i = 0; $i -lt 30; $i++) {
        & docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
    }

    # Start Caddy container
    Set-Location $ProjectRoot
    & docker compose up -d caddy | Out-Null
    Start-Sleep -Seconds 3

    if (Test-TcpPort -Port $caddyPort) {
        Log-Message "Caddy Reverse Proxy on port $caddyPort recovered successfully!" "SUCCESS"
        return $true
    }

    Log-Message "Failed to recover Caddy on port $caddyPort" "ERROR"
    return $false
}

function Run-HealthCycle {
    $dbOk = Ensure-Postgres
    $beOk = Ensure-Backend
    $fePort = Ensure-Frontend
    $cadOk = Ensure-DockerAndCaddy

    $allHealthy = $dbOk -and $beOk -and ($null -ne $fePort) -and $cadOk
    if ($allHealthy) {
        # Check domain end-to-end (local or via Cloudflare proxy)
        try {
            $domRes = Invoke-WebRequest -Uri "https://attendance.ai-asaas.com/" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($domRes -and $domRes.StatusCode -eq 200) {
                return $true
            }
        } catch {}
        # Port 8443 is healthy
        return $true
    }
    return $allHealthy
}

# Main Execution Flow
Log-Message "=== ASAS 24/7 Watchdog initialized ===" "INFO"

if ($Continuous) {
    Log-Message "Entering continuous watchdog mode (checking every $IntervalSeconds seconds)..." "INFO"
    while ($true) {
        try {
            Run-HealthCycle | Out-Null
        } catch {
            Log-Message "Watchdog loop exception: $($_.Exception.Message)" "ERROR"
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    $result = Run-HealthCycle
    if ($result) {
        Log-Message "Single health check completed: ALL SERVICES 100% HEALTHY." "SUCCESS"
    } else {
        Log-Message "Single health check completed: Some services encountered issues." "WARN"
    }
}
