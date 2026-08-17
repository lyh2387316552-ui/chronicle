@echo off
chcp 65001 >nul
title Chronicle Data Update (Read-only)
cd /d "%~dp0.."

echo ==================================================
echo    Chronicle Data Update (只读模式)
echo    Step 1: Pull latest data from chronicle-data
echo    Step 2: Generate web data locally
echo    不推送、不修改远程仓库, 适合团队成员使用
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

rem === 数据仓库位置 (项目同级目录) ===
set "DATA_REPO=%~dp0..\..\chronicle-data"

if not exist "%DATA_REPO%\.git" (
    echo [Step 0] 数据仓库不存在，正在克隆...
    git clone https://github.com/lyh2387316552-ui/chronicle-data.git "%DATA_REPO%"
    if errorlevel 1 (
        echo [ERROR] 克隆数据仓库失败，请检查网络
        pause
        exit /b 1
    )
)

echo [Step 1/2] Pulling data repo...
echo ------------------------------------------------
cd /d "%DATA_REPO%"
git pull
echo.

echo [Step 2/2] Generating web data...
echo ------------------------------------------------
cd /d "%~dp0.."
"%NODE_EXE%" tools\import.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] 生成数据失败!
    echo.
    pause
    exit /b 1
)
echo.

echo ==================================================
echo   Done! 数据已是最新。
echo   本地预览: 双击 index.html 或用 dev-server
echo   线上预览: https://lyh2387316552-ui.github.io/chronicle/
echo   (如需发布更新, 请使用 一键同步.bat 且拥有仓库写权限)
echo ==================================================
echo.
pause
