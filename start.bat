@echo off
title Ping Monitor Server
echo ========================================
echo   Ping Monitor - Starting Server
echo ========================================
echo.
echo Server will be available at:
echo   http://localhost:8000
echo.
echo Other devices on your network can access:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do echo   http://%%a:8000
echo.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.
set "VENV_PY=%~dp0.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    echo [ERROR] Virtual environment not found: %VENV_PY%
    echo.
    echo To fix, run:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

cd /d "%~dp0backend"
"%VENV_PY%" main.py
pause
