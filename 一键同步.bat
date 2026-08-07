@echo off
chcp 65001 >nul
title Chronicle One-Click Sync
cd /d "%~dp0"

echo ==================================================
echo    Chronicle Data Sync Tool
echo    Step 1: Copy local tables to data-sources
echo    Step 2: Parse data and generate web data
echo ==================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Install from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "copy-data.js" (
    echo [ERROR] copy-data.js not found!
    echo.
    pause
    exit /b 1
)

if not exist "import.js" (
    echo [ERROR] import.js not found!
    echo.
    pause
    exit /b 1
)

echo [Step 1/2] Copying data sources...
echo ------------------------------------------------
node copy-data.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Copy data failed!
    echo.
    pause
    exit /b 1
)
echo.

echo [Step 2/2] Importing data...
echo ------------------------------------------------
node import.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Import data failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ==================================================
echo   Done! Refresh index.html to view data.
echo ==================================================
echo.
pause
