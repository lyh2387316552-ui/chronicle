@echo off
chcp 65001 >nul
title Chronicle One-Click Sync
cd /d "%~dp0.."

echo ==================================================
echo    Chronicle Data Sync Tool
echo    Step 1: Pull data repo (chronicle-data)
echo    Step 2: Copy local tables to data repo
echo    Step 3: Push data repo
echo    Step 4: Parse data, sync icons, generate web data
echo    Step 5: Push website repo
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

echo [Step 1/5] Pulling data repo...
echo ------------------------------------------------
cd /d "%DATA_REPO%"
git pull
echo.

echo [Step 2/5] Copying data sources...
echo ------------------------------------------------
cd /d "%~dp0.."
"%NODE_EXE%" tools\copy-data.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Copy data failed!
    echo.
    pause
    exit /b 1
)
echo.

echo [Step 3/5] Pushing data repo...
echo ------------------------------------------------
cd /d "%DATA_REPO%"
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "sync: 数据源更新" -q
    git push
    if errorlevel 1 (
        echo.
        echo [ERROR] Push data repo failed!
        echo.
        pause
        exit /b 1
    )
    echo "  ^^ 数据仓库已推送"
) else (
    echo "  无变更，跳过推送"
)
echo.

echo [Step 4/5] Importing data...
echo ------------------------------------------------
cd /d "%~dp0.."
"%NODE_EXE%" tools\import.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Import data failed!
    echo.
    pause
    exit /b 1
)
echo.

echo [Step 5/5] Pushing website repo...
echo ------------------------------------------------
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "sync: 网页数据更新" -q
    git push
    if errorlevel 1 (
        echo.
        echo [ERROR] Push website repo failed!
        echo.
        pause
        exit /b 1
    )
    echo "  ^^ 网站仓库已推送"
) else (
    echo "  无变更，跳过推送"
)
echo.

echo ==================================================
echo   Done! Pages will update in 1-2 minutes.
echo ==================================================
echo.
pause
