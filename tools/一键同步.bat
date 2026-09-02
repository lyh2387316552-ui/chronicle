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
    if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
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

git -C "%DATA_REPO%" rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 数据仓库没有可用的 Git 提交历史，请重新克隆 chronicle-data
    echo [INFO] 当前目录: %DATA_REPO%
    pause
    exit /b 1
)

git -C "%DATA_REPO%" config user.name "chronicle-bot"
git -C "%DATA_REPO%" config user.email "2387316552@users.noreply.github.com"

echo [Step 1/5] Pulling data repo...
echo ------------------------------------------------
cd /d "%DATA_REPO%"
git pull --ff-only
if errorlevel 1 (
    echo [ERROR] 拉取数据仓库失败，已停止同步
    pause
    exit /b 1
)
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
    if errorlevel 1 (
        echo [ERROR] 数据仓库提交失败，已停止同步
        pause
        exit /b 1
    )
    git push
    if errorlevel 1 (
        echo [ERROR] 数据仓库推送失败，已停止同步
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
git config user.name "chronicle-bot"
git config user.email "2387316552@users.noreply.github.com"
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "sync: 网页数据更新" -q
    if errorlevel 1 (
        echo [ERROR] 网站仓库提交失败，已停止同步
        pause
        exit /b 1
    )
    git push
    if errorlevel 1 (
        echo [ERROR] 网站仓库推送失败，已停止同步
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
