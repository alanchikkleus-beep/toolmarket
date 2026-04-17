@echo off
set PYEXE=C:\Users\Alansher\AppData\Local\Python\pythoncore-3.14-64\python.exe
cd /d "C:\Users\Alansher\Desktop\DEMO ALAN\backend"
call .venv\Scripts\activate.bat 2>nul
start "" /min cmd /c ""%PYEXE%" -m uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 4 >nul
start http://127.0.0.1:8000
