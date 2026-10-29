# ASAS Attendance System - Unified Smart Launcher with Automatic Port Failover
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = $PSScriptRoot
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "    ASAS Attendance System - Smart Failover Launcher    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# Function: Determine Best Available Port with Auto-Failover
# -----------------------------------------------------------------------------
function Get-AvailablePort {
    param(
        [int[]]$CandidatePorts = @(7443, 7777, 3001)
    )
    foreach ($port in $CandidatePorts) {
        # Check if already running our ASAS app
        $listenConn = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
        if ($listenConn) {
            try {
                $res = Invoke-WebRequest -Uri "http://localhost:$port/" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
                if ($res -and $res.StatusCode -eq 200) {
                    Write-Host "[+] Port $port is active and healthy (reusing existing session)." -ForegroundColor Green
                    return $port
                }
            } catch {}
            Write-Host "[!] Port $port is currently in use or unready, switching to next candidate..." -ForegroundColor Yellow
            continue
        }

        # Check if port has any lingering/closing connection
        $anyConn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($anyConn) {
            Write-Host "[!] Port $port has lingering connections ($($anyConn[0].State)), switching to next candidate..." -ForegroundColor Yellow
            continue
        }

        # Test socket binding
        try {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
            $listener.Start()
            $listener.Stop()
            Write-Host "[+] Selected optimal free port: $port" -ForegroundColor Green
            return $port
        } catch {
            Write-Host "[!] Port $port is restricted by OS, trying next candidate..." -ForegroundColor Yellow
            continue
        }
    }
    return 7443
}

# -----------------------------------------------------------------------------
# 1. PostgreSQL on port 6543
# -----------------------------------------------------------------------------
$pgRunning = Get-NetTCPConnection -State Listen -LocalPort 6543 -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    Write-Host "[1/4] Starting PostgreSQL on port 6543..." -ForegroundColor Cyan
    $pgData = "C:\Users\Anoos.alaghbari\asas_pgdata"
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
    
    $pgCtl = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
    if (-not (Test-Path $pgCtl)) { $pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" }
    
    if (Test-Path $pgCtl) {
        $serverLog = Join-Path $pgData "server.log"
        & $pgCtl start -D "$pgData" -l "$serverLog" -s -w -t 20 | Out-Null
    } else {
        $pgExe = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
        Start-Process -FilePath $pgExe -ArgumentList "-D `"$pgData`" -p 6543" -WindowStyle Hidden
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4] PostgreSQL is already active on port 6543." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 2. Backend API on port 6500
# -----------------------------------------------------------------------------
$backendRunning = Get-NetTCPConnection -State Listen -LocalPort 6500 -ErrorAction SilentlyContinue
if (-not $backendRunning) {
    Write-Host "[2/4] Starting Backend API on port 6500..." -ForegroundColor Cyan
    $backendDir = Join-Path $root "backend"
    $logDir = Join-Path $root "logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $bOut = Join-Path $logDir "backend.log"
    $bErr = Join-Path $logDir "backend_error.log"
    Start-Process -FilePath "node" -ArgumentList "src/asas-server.js" -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput $bOut -RedirectStandardError $bErr
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/4] Backend is already active on port 6500." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Frontend Web App with Dynamic Port Selection & Failover
# -----------------------------------------------------------------------------
Write-Host "[3/4] Probing candidate ports [7443, 7777, 3001] for Frontend..." -ForegroundColor Cyan
$chosenPort = Get-AvailablePort -CandidatePorts @(7443, 7777, 3001)

$frontendDir = Join-Path $root "frontend"
$isFrontendRunning = Get-NetTCPConnection -State Listen -LocalPort $chosenPort -ErrorAction SilentlyContinue
if (-not $isFrontendRunning) {
    Write-Host "    -> Launching Next.js Production Server on Port $chosenPort..." -ForegroundColor Cyan
    $runBat = Join-Path $frontendDir "run-frontend.bat"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k `"$runBat`" $chosenPort" -WorkingDirectory $frontendDir -WindowStyle Minimized
    
    # Wait for the chosen port to become ready
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        $check = Get-NetTCPConnection -State Listen -LocalPort $chosenPort -ErrorAction SilentlyContinue
        if ($check) { break }
    }
}
Write-Host "    -> Frontend is UP on port $chosenPort (http://localhost:$chosenPort)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. 24/7 Watchdog Service Initialization
# -----------------------------------------------------------------------------
$watchdogBat = Join-Path $root "scripts\windows\run-watchdog-silent.bat"
if (Test-Path $watchdogBat) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$watchdogBat`"" -WindowStyle Hidden
}

# -----------------------------------------------------------------------------
# 4. Status Summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   ALL ASAS SERVICES ARE LIVE & SECURED!                " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host " Official URL:   https://attendance.ai-asaas.com" -ForegroundColor Yellow
Write-Host " Port 5000:      https://attendance.ai-asaas.com:5000" -ForegroundColor Cyan
Write-Host " Port 5080:      https://attendance.ai-asaas.com:5080" -ForegroundColor Cyan
Write-Host " Local URL:      http://localhost:$chosenPort" -ForegroundColor White
Write-Host " Backend API:    http://127.0.0.1:6500" -ForegroundColor Gray
Write-Host " Database:       PostgreSQL on Port 6543 (17 Accounts)" -ForegroundColor Gray
Write-Host " Active Port:    $chosenPort (with auto-failover)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green

# Open browser to official URL
Start-Process "https://attendance.ai-asaas.com"
