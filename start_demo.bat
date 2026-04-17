@echo off
:: ShadowLink Minimal Start Script

echo Starting ShadowLink Python Backend...
start "ShadowLink AI Service" cmd.exe /c "cd shadowlink-ai && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting ShadowLink React Frontend...
start "ShadowLink Web UI" cmd.exe /c "cd shadowlink-web && npx vite --port 3000"

echo Waiting for services to start...
timeout /t 5 /nobreak >nul

echo Opening browser...
start http://localhost:3000

echo Done! You can close this window.
exit