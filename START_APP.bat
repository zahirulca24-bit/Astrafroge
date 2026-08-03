@echo off
setlocal
cd /d "%~dp0"

echo [AstraForge] Checking prerequisites...
where python >nul 2>nul || (echo Python is not installed or not on PATH.& pause & exit /b 1)
where node >nul 2>nul || (echo Node.js is not installed or not on PATH.& pause & exit /b 1)
where npm >nul 2>nul || (echo npm is not installed or not on PATH.& pause & exit /b 1)

if not exist "frontend\.env.local" (
  >"frontend\.env.local" echo VITE_API_BASE_URL=http://localhost:8000
)

if not exist "frontend\node_modules" (
  echo [AstraForge] Installing frontend dependencies...
  pushd frontend
  call npm install
  if errorlevel 1 (popd & echo Frontend dependency installation failed.& pause & exit /b 1)
  popd
)

echo [AstraForge] Starting FastAPI backend on port 8000...
start "AstraForge Backend" cmd /k "cd /d ""%~dp0backend"" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [AstraForge] Starting Vite frontend on port 5173...
start "AstraForge Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 3 /nobreak >nul
start "" http://localhost:5173

echo [AstraForge] Both local processes were launched in separate windows.
endlocal
