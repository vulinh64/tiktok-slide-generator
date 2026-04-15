@echo off
setlocal ENABLEDELAYEDEXPANSION

git pull --ff-only origin
if %ERRORLEVEL% neq 0 (
    echo Git pull failed. Exiting.
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Docker is already running.
) else (
    echo Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    set attempts=0

    :loop
    set /a attempts+=1

    if !attempts! gtr 12 (
        echo Docker failed to start after 12 attempts. Exiting.
        exit /b 1
    )

    echo Waiting for Docker daemon... attempt !attempts!/12
    timeout /t 5 /nobreak >nul

    docker info >nul 2>&1
    if %ERRORLEVEL% neq 0 goto loop

    echo Docker is ready.
)

docker compose up --build
docker compose up --detach