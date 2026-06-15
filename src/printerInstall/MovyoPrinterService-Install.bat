@echo off
setlocal
cd /d "%~dp0"

set NSSM="%~dp0nssm.exe"
set NODE="%~dp0node\node.exe"
set SERVICE_DIR=%~dp0services
set SERVICE_NAME=MovyoPrinterService

%NSSM% stop %SERVICE_NAME% >nul 2>nul
%NSSM% remove %SERVICE_NAME% confirm >nul 2>nul

%NSSM% install %SERVICE_NAME% %NODE%
%NSSM% set %SERVICE_NAME% AppParameters "index.js"
%NSSM% set %SERVICE_NAME% AppDirectory "%SERVICE_DIR%"
%NSSM% set %SERVICE_NAME% DisplayName "Movyo Printer Service"
%NSSM% set %SERVICE_NAME% Description "Serviço local de impressão do Movyo Food"
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START
%NSSM% set %SERVICE_NAME% AppStdout "%~dp0service.log"
%NSSM% set %SERVICE_NAME% AppStderr "%~dp0service-error.log"
%NSSM% set %SERVICE_NAME% AppRotateFiles 1
%NSSM% set %SERVICE_NAME% AppRotateOnline 1
%NSSM% set %SERVICE_NAME% AppRotateBytes 1048576

%NSSM% start %SERVICE_NAME%
exit /b %ERRORLEVEL%
