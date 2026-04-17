@echo off
:: ShadowLink Full L1 Start Script (Java + Python + Web)

echo [1/3] Starting ShadowLink Python Backend (Port 8000)...
start "ShadowLink Python AI Service" cmd.exe /k "cd shadowlink-ai && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] Starting ShadowLink Java Gateway (Port 8080)...
if exist "shadowlink-server\shadowlink-starter\target" (
    echo - Found existing build.
    echo   If you changed Java code and want to force a clean rebuild, delete the "target" folder first.
    echo   Starting directly...
    start "ShadowLink Java Gateway" cmd.exe /k "cd shadowlink-server\shadowlink-starter && ..\mvnw spring-boot:run"
) else (
    echo - First time build required. This will take a moment...
    start "ShadowLink Java Gateway" cmd.exe /k "cd shadowlink-server && mvnw clean install -DskipTests && cd shadowlink-starter && ..\mvnw spring-boot:run"
)

echo [3/3] Starting ShadowLink React Frontend (Port 3000)...
start "ShadowLink Web UI" cmd.exe /k "cd shadowlink-web && npx vite --port 3000"

echo Waiting for services to start (15s for Java)...
timeout /t 15 /nobreak >nul

echo Opening browser...
start http://localhost:3000

echo Done! You can close this window.
exit