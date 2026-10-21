# ASAS Attendance System - Unified Background Launcher
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = $PSScriptRoot

# 1. PostgreSQL on port 5433
$pgRunning = Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    Write-Host "[1/4] Starting PostgreSQL on port 5433..." -ForegroundColor Cyan
    $pgData = "C:\Users\Anoos.alaghbari\asas_pgdata"
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
    
    $pgExe = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
    if (-not (Test-Path $pgExe)) { $pgExe = "C:\Program Files\PostgreSQL\17\bin\postgres.exe" }
    
    Start-Process -FilePath $pgExe -ArgumentList "-D `"$pgData`" -p 5433" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/4] PostgreSQL is already active on port 5433." -ForegroundColor Green
}

# 2. Backend on port 5000
$backendRunning = Get-NetTCPConnection -State Listen -LocalPort 5000 -ErrorAction SilentlyContinue
if (-not $backendRunning) {
    Write-Host "[2/4] Starting Backend API on port 5000..." -ForegroundColor Cyan
    $backendDir = Join-Path $root "backend"
    Start-Process -FilePath "node" -ArgumentList "src/asas-server.js" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/4] Backend is already active on port 5000." -ForegroundColor Green
}

# 3. Frontend on port 3000
$frontendRunning = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $frontendRunning) {
    Write-Host "[3/4] Starting Frontend on port 3000..." -ForegroundColor Cyan
    $frontendDir = Join-Path $root "frontend"
    Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory $frontendDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[3/4] Frontend is already active on port 3000." -ForegroundColor Green
}

# 4. Cloudflare Tunnel
$tunnelRunning = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if (-not $tunnelRunning) {
    $cfExe = Join-Path $root ".local\cloudflared.exe"
    if (Test-Path $cfExe) {
        Write-Host "[4/4] Starting Cloudflare Tunnel..." -ForegroundColor Cyan
        Start-Process -FilePath $cfExe -ArgumentList "tunnel --url http://localhost:3000" -WindowStyle Hidden
    }
} else {
    Write-Host "[4/4] Cloudflare Tunnel is already active." -ForegroundColor Green
}

Start-Process "http://localhost:3000/asas"
Write-Host "All ASAS services are active!" -ForegroundColor Green
