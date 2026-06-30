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
cd /d "%~dp0backend"
python main.py
pause
