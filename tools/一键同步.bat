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

rem === Git 网络参数 ===
rem 固定 OpenSSL + HTTP/1.1，避免 Schannel/HTTP2 长连接被代理或线路重置
set "GIT_HTTP_OPTS=-c http.sslBackend=openssl -c http.version=HTTP/1.1 -c http.maxRequests=1 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=120"
set "GIT_RETRY_MAX=5"

rem Git 不会自动继承浏览器的 Windows 用户代理，运行时读取并复用它
set "SYSTEM_PROXY_ENABLED="
set "SYSTEM_PROXY_SERVER="
for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable 2^>nul') do set "SYSTEM_PROXY_ENABLED=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer 2^>nul') do set "SYSTEM_PROXY_SERVER=%%B"
if /i "%SYSTEM_PROXY_ENABLED%"=="0x1" if defined SYSTEM_PROXY_SERVER set "GIT_HTTP_OPTS=%GIT_HTTP_OPTS% -c http.proxy=http://%SYSTEM_PROXY_SERVER%"
if /i "%SYSTEM_PROXY_ENABLED%"=="0x1" if defined SYSTEM_PROXY_SERVER echo [INFO] 已使用 Windows 系统代理：%SYSTEM_PROXY_SERVER%

if not exist "%DATA_REPO%\.git" (
    echo [Step 0] 数据仓库不存在，正在克隆...
    call :git_clone_retry
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
call :git_pull_retry
if errorlevel 1 (
    echo [ERROR] 拉取数据仓库失败，已完成全部重试，本次同步已安全停止
    echo [INFO] 本地数据未被覆盖；请稍后再次点击一键同步
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
    call :git_push_retry
    if errorlevel 1 (
        echo [ERROR] 数据仓库推送失败，已完成全部重试
        echo [INFO] 本地提交仍然保留，下次同步会继续上传
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
    call :git_push_retry
    if errorlevel 1 (
        echo [ERROR] 网站仓库推送失败，已完成全部重试
        echo [INFO] 本地提交仍然保留，下次同步会继续上传
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
exit /b 0

:git_clone_retry
set "GIT_RETRY=1"
:git_clone_again
echo [INFO] 正在克隆数据仓库（第 %GIT_RETRY%/%GIT_RETRY_MAX% 次）...
git %GIT_HTTP_OPTS% clone https://github.com/lyh2387316552-ui/chronicle-data.git "%DATA_REPO%"
if not errorlevel 1 exit /b 0
if %GIT_RETRY% GEQ %GIT_RETRY_MAX% exit /b 1
set /a GIT_WAIT=GIT_RETRY*GIT_RETRY+2
echo [WARN] 连接被中断，%GIT_WAIT% 秒后重试...
timeout /t %GIT_WAIT% /nobreak >nul
set /a GIT_RETRY+=1
goto git_clone_again

:git_pull_retry
set "GIT_RETRY=1"
:git_pull_again
echo [INFO] 正在拉取数据仓库（第 %GIT_RETRY%/%GIT_RETRY_MAX% 次）...
git %GIT_HTTP_OPTS% pull --ff-only
if not errorlevel 1 exit /b 0
if %GIT_RETRY% GEQ %GIT_RETRY_MAX% exit /b 1
set /a GIT_WAIT=GIT_RETRY*GIT_RETRY+2
echo [WARN] 连接被中断，%GIT_WAIT% 秒后重试...
timeout /t %GIT_WAIT% /nobreak >nul
set /a GIT_RETRY+=1
goto git_pull_again

:git_push_retry
set "GIT_RETRY=1"
:git_push_again
echo [INFO] 正在推送仓库（第 %GIT_RETRY%/%GIT_RETRY_MAX% 次）...
git %GIT_HTTP_OPTS% push
if not errorlevel 1 exit /b 0
if %GIT_RETRY%==1 (
    echo [INFO] 推送被远程新提交拒绝，正在获取远程并整理本地提交...
    git %GIT_HTTP_OPTS% fetch origin main
    if not errorlevel 1 (
        git %GIT_HTTP_OPTS% rebase origin/main
        if errorlevel 1 (
            echo [ERROR] 本地提交与远程内容冲突，已停止并保留现场，请先处理冲突
            git rebase --abort >nul 2>&1
            exit /b 1
        )
    )
)
if %GIT_RETRY% GEQ %GIT_RETRY_MAX% exit /b 1
set /a GIT_WAIT=GIT_RETRY*GIT_RETRY+2
echo [WARN] 连接被中断，%GIT_WAIT% 秒后重试...
timeout /t %GIT_WAIT% /nobreak >nul
set /a GIT_RETRY+=1
goto git_push_again
