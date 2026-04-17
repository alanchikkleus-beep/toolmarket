@echo off
chcp 65001 >nul
title ToolMarket Monitor (Node.js)

echo ====================================================
echo  ToolMarket Monitor — Node.js бэкенд
echo ====================================================
echo.

:: Проверить Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [!] Node.js не найден. Устанавливаем через winget...
  winget install --id OpenJS.NodeJS --source winget --accept-package-agreements --accept-source-agreements
  if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ОШИБКА] Установка не удалась.
    echo Установите Node.js вручную с сайта nodejs.org
    echo.
    pause & exit /b 1
  )
  :: Обновить PATH
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

echo [OK] Node.js:
node --version

cd /d "%~dp0backend-node"

if not exist "node_modules" (
  echo Установка пакетов...
  npm install
)

echo.
echo ====================================================
echo  Сервер запущен на http://127.0.0.1:8000
echo  Нажмите Ctrl+C для остановки
echo ====================================================
echo.

start "" /b cmd /c "timeout /t 2 >nul && start http://127.0.0.1:8000"

node server.js

pause
