@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ==================================================
echo    Chronicle Data Import Tool
echo ==================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    echo Download: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check import.js
if not exist "import.js" (
    echo [ERROR] import.js not found!
    echo Please make sure this bat file is in the same folder as import.js
    echo.
    pause
    exit /b 1
)

:: Check xlsx.min.js
if not exist "xlsx.min.js" (
    echo [ERROR] xlsx.min.js not found!
    echo Please make sure this bat file is in the same folder as xlsx.min.js
    echo.
    pause
    exit /b 1
)

echo Starting import...
echo.
node import.js
echo.
echo ==================================================
echo Import complete! Open index.html to view data.
echo ==================================================
echo.
pause
