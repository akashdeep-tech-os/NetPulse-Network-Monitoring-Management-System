@echo off
title Ping Monitor - Build Installer
cd /d "%~dp0"

echo ========================================
echo   Building Ping Monitor Installer
echo ========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found. Run:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

echo [1/3] Building frontend...
pushd frontend
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed. Is Node.js installed?
    popd
    pause
    exit /b 1
)
popd

echo.
echo [2/3] Building executable with PyInstaller...
".venv\Scripts\pip" install pyinstaller --quiet
".venv\Scripts\pyinstaller" --noconfirm --clean PingMonitor.spec
if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Building installer with Inno Setup...
set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
    echo [ERROR] Inno Setup not found. Install from https://jrsoftware.org/isinfo.php
    pause
    exit /b 1
)
"%ISCC%" installer.iss
if errorlevel 1 (
    echo [ERROR] Installer build failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Build complete!
echo   Installer: %~dp0installer\PingMonitor-Setup-1.0.0.exe
echo ========================================
pause
