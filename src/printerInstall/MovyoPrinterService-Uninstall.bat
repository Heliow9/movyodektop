@echo off
setlocal
cd /d "%~dp0"
set NSSM="%~dp0nssm.exe"
set SERVICE_NAME=MovyoPrinterService
%NSSM% stop %SERVICE_NAME% >nul 2>nul
%NSSM% remove %SERVICE_NAME% confirm
exit /b 0
