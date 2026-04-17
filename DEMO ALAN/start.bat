@echo off
title ToolMarket Monitor

set PYEXE=C:\Users\Alansher\AppData\Local\Python\pythoncore-3.14-64\python.exe

echo ================================
echo  ToolMarket Monitor
echo ================================
echo.

echo Step 1: Installing packages...
"%PYEXE%" -m pip install fastapi uvicorn httpx beautifulsoup4 lxml aiofiles

echo.
echo Step 2: Starting server...
echo Open browser: http://127.0.0.1:8000
echo Press Ctrl+C to stop.
echo.

cd /d "%~dp0backend"
"%PYEXE%" -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
