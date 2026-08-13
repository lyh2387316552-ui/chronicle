@echo off
chcp 65001 >nul
title Chronicle One-Click Sync
cd /d "%~dp0.."

echo ==================================================
echo    Chronicle Data Sync Tool
echo    Step 1: Copy local tables to data-sources
echo    Step 2: Parse data, sync icons, generate web data
echo ==================================================
echo.

rem === Find Node.js ===
set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node"

if not defined NODE_EXE (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)
if not defined NODE_EXE (
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
)
if not defined NODE_EXE (
    if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
)
if not defined NODE_EXE (
    if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
)

if not defined NODE_EXE (
    echo [ERROR] Node.js not found!
    echo Please install from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Using Node: %NODE_EXE%
echo.

if not exist "tools\copy-data.js" (
    echo [ERROR] tools\copy-data.js not found!
    echo.
    pause
    exit /b 1
)

if not exist "tools\import.js" (
    echo [ERROR] tools\import.js not found!
    echo.
    pause
    exit /b 1
)

echo [Step 1/2] Copying data sources...
echo ------------------------------------------------
"%NODE_EXE%" tools\copy-data.js
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
"%NODE_EXE%" tools\import.js
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
