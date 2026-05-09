@echo off
:: ShadowLink Start Script (Python + Java + Web)

cd /d "%~dp0"

echo [1/3] Starting ShadowLink Python Backend (Port 8000)...
start "ShadowLink Python AI Service" /D "%~dp0shadowlink-ai" cmd.exe /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] Starting ShadowLink Java Gateway (Port 8080)...
if exist "shadowlink-server\shadowlink-starter\target" (
    echo - Found existing Java build.
    echo   If you changed Java code and want a clean rebuild, delete shadowlink-server\shadowlink-starter\target first.
    start "ShadowLink Java Gateway" /D "%~dp0shadowlink-server\shadowlink-starter" cmd.exe /k "..\mvnw spring-boot:run"
) else (
    echo - First time Java build required. This will take a moment...
    start "ShadowLink Java Gateway" /D "%~dp0shadowlink-server" cmd.exe /k "mvnw clean install -DskipTests && cd shadowlink-starter && ..\mvnw spring-boot:run"
)

echo [3/3] Starting ShadowLink React Frontend (Port 3000)...
start "ShadowLink Web UI" /D "%~dp0shadowlink-web" cmd.exe /k "npx vite --port 3000"

echo Waiting for services to start (15s for Java)...
timeout /t 15 /nobreak >nul

echo Opening browser...
start http://localhost:3000

echo Done! You can close this window.
exit