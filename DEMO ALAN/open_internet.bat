@echo off
title Открыть доступ из интернета (ngrok)
chcp 65001 >nul

echo =============================================
echo   Публичный доступ к ToolMarket Monitor
echo =============================================
echo.

:: Проверить есть ли ngrok
if exist "%~dp0ngrok.exe" goto :run_ngrok

:: Скачать ngrok
echo Скачиваем ngrok (один раз, ~20 МБ)...
powershell -Command "Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile '%~dp0ngrok.zip'"
powershell -Command "Expand-Archive -Path '%~dp0ngrok.zip' -DestinationPath '%~dp0' -Force"
del "%~dp0ngrok.zip" >nul 2>&1
echo Готово!
echo.

:run_ngrok
echo Запускаем публичный туннель...
echo.
echo ВАЖНО: сейчас откроется браузер.
echo Там будет ВАШ ПУБЛИЧНЫЙ АДРЕС - скопируйте его
echo и отправьте на телефон или другое устройство.
echo.
echo Пока это окно открыто - ссылка работает везде.
echo Закроете окно - ссылка перестанет работать.
echo.

start "" /b "%~dp0ngrok.exe" http 8000
timeout /t 3 >nul
start http://127.0.0.1:4040

echo.
echo Адрес туннеля смотрите в открывшейся вкладке браузера
echo (там будет строчка "Forwarding: https://xxxx.ngrok-free.app")
echo.
pause
