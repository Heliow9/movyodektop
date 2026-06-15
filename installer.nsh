!macro customInstall
  DetailPrint "Instalando/atualizando Movyo Printer Service..."
  SetOutPath "$INSTDIR\resources\printerInstall"
  nsExec::ExecToLog '"$INSTDIR\resources\printerInstall\MovyoPrinterService-Install.bat"'
!macroend

!macro customUnInstall
  DetailPrint "Removendo Movyo Printer Service..."
  nsExec::ExecToLog '"$INSTDIR\resources\printerInstall\MovyoPrinterService-Uninstall.bat"'
!macroend
