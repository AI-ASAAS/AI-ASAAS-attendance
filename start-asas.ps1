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
        [int[]]$CandidatePorts = @(7443, 7777, 3001, 3000)
    )
    foreach ($port in $CandidatePorts) {
        # Check if already running our ASAS app
        $listenConn = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
        if ($listenConn) {
            try {
                $res = Invoke-WebRequest -Uri "http://localhost:$port/asas" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
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
    return 3000
}

# -----------------------------------------------------------------------------
# 1. PostgreSQL on port 5433
# -----------------------------------------------------------------------------
$pgRunning = Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    Write-Host "[1/4] Starting PostgreSQL on port 5433..." -ForegroundColor Cyan
    $pgData = "C:\Users\Anoos.alaghbari\asas_pgdata"
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
    
    $pgExe = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
    if (-not (Test-Path $pgExe)) { $pgExe = "C:\Program Files\PostgreSQL\17\bin\postgres.exe" }
    
    Start-Process -FilePath $pgExe -ArgumentList "-D `"$pgData`" -p 5433" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4] PostgreSQL is already active on port 5433." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 2. Backend API on port 5000
# -----------------------------------------------------------------------------
$backendRunning = Get-NetTCPConnection -State Listen -LocalPort 5000 -ErrorAction SilentlyContinue
if (-not $backendRunning) {
    Write-Host "[2/4] Starting Backend API on port 5000..." -ForegroundColor Cyan
    $backendDir = Join-Path $root "backend"
    Start-Process -FilePath "node" -ArgumentList "src/asas-server.js" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/4] Backend is already active on port 5000." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Frontend Web App with Dynamic Port Selection & Failover
# -----------------------------------------------------------------------------
Write-Host "[3/4] Probing candidate ports [7443, 7777, 3001, 3000] for Frontend..." -ForegroundColor Cyan
$chosenPort = Get-AvailablePort -CandidatePorts @(7443, 7777, 3001, 3000)

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
Write-Host "    -> Frontend is UP on port $chosenPort (http://localhost:$chosenPort/asas)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. Cloudflare Remote Tunnel targeting the chosen port
# -----------------------------------------------------------------------------
$cfExe = Join-Path $root ".local\cloudflared.exe"
$tunnelLog = Join-Path $root ".local\tunnel.log"
$urlFile = Join-Path $root "active-url.txt"

$cfProcess = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
$needRestartTunnel = (-not $cfProcess)

if ($cfProcess -and (Test-Path $tunnelLog)) {
    # Check if existing tunnel was routed to a different port
    $prevPortMatch = Select-String -Path $tunnelLog -Pattern "http://localhost:(\d+)" | Select-Object -Last 1
    if ($prevPortMatch -and $prevPortMatch.Matches.Groups[1].Value -ne "$chosenPort") {
        Write-Host "[4/4] Existing tunnel target mismatch, adjusting to port $chosenPort..." -ForegroundColor Yellow
        Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
        $needRestartTunnel = $true
    }
}

if ($needRestartTunnel -and (Test-Path $cfExe)) {
    Write-Host "[4/4] Starting Cloudflare Remote Tunnel for port $chosenPort..." -ForegroundColor Cyan
    if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue }
    Start-Process -FilePath $cfExe -ArgumentList "tunnel --url http://localhost:$chosenPort --logfile `"$tunnelLog`"" -WindowStyle Minimized
    
    # Wait up to 10 seconds to capture the public URL
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $tunnelLog) {
            $found = Get-Content $tunnelLog -ErrorAction SilentlyContinue | Select-String "https://[a-zA-Z0-9\-]+\.trycloudflare\.com"
            if ($found) { break }
        }
    }
} else {
    Write-Host "[4/4] Cloudflare Tunnel is already active and routing to port $chosenPort." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# Extract & Display Public and Local URLs
# -----------------------------------------------------------------------------
$publicUrl = ""
if (Test-Path $tunnelLog) {
    $match = Get-Content $tunnelLog -ErrorAction SilentlyContinue | Select-String "https://[a-zA-Z0-9\-]+\.trycloudflare\.com" | Select-Object -Last 1
    if ($match -and $match.Line -match "(https://[a-zA-Z0-9\-]+\.trycloudflare\.com)") {
        $publicUrl = "$($matches[1])"
        Set-Content -Path $urlFile -Value $publicUrl -Encoding UTF8
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   ALL ASAS SERVICES ARE LIVE & SECURED!                " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host " Official URL:   https://attendance.ai-asaas.com" -ForegroundColor Yellow
Write-Host " Local URL:      http://localhost:$chosenPort" -ForegroundColor White
if ($publicUrl) {
    Write-Host " Public Tunnel:  $publicUrl" -ForegroundColor Cyan
    Write-Host " (Saved to file: active-url.txt)" -ForegroundColor Gray
}
Write-Host " Active Port:    $chosenPort (with auto-failover)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green

# Open browser to local dashboard
Start-Process "http://localhost:$chosenPort"
