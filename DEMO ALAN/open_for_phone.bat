@echo off
title Доступ с телефона

echo Открываем доступ с телефона...
echo.

:: Открыть порт 8000 в файерволе Windows
netsh advfirewall firewall delete rule name="ToolMarket Monitor" >nul 2>&1
netsh advfirewall firewall add rule name="ToolMarket Monitor" dir=in action=allow protocol=TCP localport=8000 >nul 2>&1

:: Найти локальный IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
  set IP=%%a
  goto :found
)

:found
set IP=%IP: =%

echo ============================================
echo   Приложение доступно с телефона!
echo ============================================
echo.
echo   Подключите телефон к той же WiFi сети
echo   и откройте в браузере:
echo.
echo   http://%IP%:8000
echo.
echo ============================================
echo.

:: Показать QR-код ссылкой
echo Или отсканируйте QR-код (откроется в браузере):
start "" "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=http://%IP%:8000"

pause
