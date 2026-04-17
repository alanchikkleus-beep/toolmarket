@echo off
title Настройка автозапуска

echo Настройка автозапуска ToolMarket Monitor...
echo.

schtasks /create ^
  /tn "ToolMarket Monitor" ^
  /tr "cmd.exe /c \"C:\Users\Alansher\Desktop\DEMO ALAN\start_hidden.bat\"" ^
  /sc onlogon ^
  /rl highest ^
  /f >nul 2>&1

if %ERRORLEVEL% EQU 0 (
  echo  Готово! Приложение будет запускаться автоматически
  echo  при каждом включении компьютера.
  echo.
  echo  Для отключения автозапуска запустите remove_autostart.bat
) else (
  echo  Ошибка. Попробуйте запустить от имени администратора:
  echo  правая кнопка на файле - "Запуск от имени администратора"
)

echo.
pause
