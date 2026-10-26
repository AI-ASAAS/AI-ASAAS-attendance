# Ensure Docker Desktop is started
$dockerProc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProc) {
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
}

# Wait for docker engine
$attempts = 0
while ($attempts -lt 40) {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 3
    $attempts++
}

# Run docker compose
Set-Location "C:\Users\Anoos.alaghbari\Desktop\مشاريع\الحظور"
docker compose up -d