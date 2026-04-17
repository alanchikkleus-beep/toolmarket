@echo off
title Отключение автозапуска

schtasks /delete /tn "ToolMarket Monitor" /f >nul 2>&1

if %ERRORLEVEL% EQU 0 (
  echo Автозапуск отключён.
) else (
  echo Автозапуск уже был отключён или не найден.
)
pause
