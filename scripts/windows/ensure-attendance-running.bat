@echo off
tasklist /fi "imagename eq Docker Desktop.exe" 2>NUL | find /i "Docker Desktop.exe" >NUL
if errorlevel 1 (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

:WAIT_DOCKER
docker info >NUL 2>&1
if errorlevel 1 (
    timeout /t 3 /nobreak >NUL
    goto WAIT_DOCKER
)

cd /d "C:\Users\Anoos.alaghbari\Desktop\??????\??????"
docker compose up -d
exit /b 0