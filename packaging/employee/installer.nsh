!define AIBOS_EMPLOYEE_INSTALLER
!include "${PROJECT_DIR}\packaging\installer-ui.nsh"

!macro customInstall
  !insertmacro AiBosSetStep 3
  DetailPrint "Configuring AI BOS Device Agent and Updater services..."
  ClearErrors
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\device-agent\install\install-device-services.ps1" -InstallRoot "$INSTDIR\resources\device-agent"' $0
  IfErrors device_services_exec_failed 0
  DetailPrint "AI BOS Device Agent services PowerShell process exit code=$0"
  IntCmp $0 0 device_services_installed 0 0
    DetailPrint "AI BOS Device Agent services NSIS interpreted result=failure"
    MessageBox MB_ICONSTOP|MB_OK "AI BOS Employee could not install required device services. Setup will stop. See %ProgramData%\AI BOS\InstallLogs\employee-device-services-install.log for details." /SD IDOK
    SetErrorLevel 2
    Quit
  device_services_exec_failed:
    DetailPrint "AI BOS Device Agent services PowerShell launch failed"
    MessageBox MB_ICONSTOP|MB_OK "AI BOS Employee could not launch the required device service installer. Setup will stop. See %ProgramData%\AI BOS\InstallLogs\employee-device-services-install.log for details." /SD IDOK
    SetErrorLevel 2
    Quit
  device_services_installed:
    DetailPrint "AI BOS Device Agent services NSIS interpreted result=success"

  DetailPrint "Configuring AI BOS Session Helper startup..."
  ClearErrors
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\device-agent\install\session-helper-task.ps1" -InstallRoot "$INSTDIR\resources\device-agent"' $0
  IfErrors session_helper_exec_failed 0
  DetailPrint "AI BOS Session Helper PowerShell process exit code=$0"
  IntCmp $0 0 session_helper_installed 0 0
    DetailPrint "AI BOS Session Helper NSIS interpreted result=failure"
    MessageBox MB_ICONSTOP|MB_OK "AI BOS Employee could not install the interactive Session Helper startup task. Setup will stop. See %ProgramData%\AI BOS\InstallLogs\employee-session-helper-install.log for details." /SD IDOK
    SetErrorLevel 2
    Quit
  session_helper_exec_failed:
    DetailPrint "AI BOS Session Helper PowerShell launch failed"
    MessageBox MB_ICONSTOP|MB_OK "AI BOS Employee could not launch the interactive Session Helper startup task installer. Setup will stop." /SD IDOK
    SetErrorLevel 2
    Quit
  session_helper_installed:
    DetailPrint "AI BOS Session Helper NSIS interpreted result=success"
    !insertmacro AiBosSetStep 4
    DetailPrint "Finalizing AI BOS Employee installation..."
    !insertmacro AiBosFinished
!macroend

!macro customUnInstall
  DetailPrint "Removing AI BOS Device Agent services"
  ClearErrors
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\device-agent\install\uninstall-device-services.ps1" -InstallRoot "$INSTDIR\resources\device-agent"' $0
  IfErrors device_services_uninstall_exec_failed 0
  DetailPrint "AI BOS Device Agent services uninstall PowerShell process exit code=$0"
  IntCmp $0 0 device_services_removed 0 0
    DetailPrint "AI BOS Device Agent services uninstall NSIS interpreted result=failure"
    MessageBox MB_ICONSTOP|MB_OK "AI BOS Employee could not remove device services cleanly. Uninstall will stop. See %ProgramData%\AI BOS\InstallLogs\employee-device-services-uninstall.log for details." /SD IDOK
    SetErrorLevel 2
    Quit
  device_services_uninstall_exec_failed:
    DetailPrint "AI BOS Device Agent services uninstall PowerShell launch failed"
    MessageBox MB_ICONSTOP|MB_OK "AI BOS Employee could not launch the device service uninstaller. Uninstall will stop. See %ProgramData%\AI BOS\InstallLogs\employee-device-services-uninstall.log for details." /SD IDOK
    SetErrorLevel 2
    Quit
  device_services_removed:
    DetailPrint "AI BOS Device Agent services uninstall NSIS interpreted result=success"
!macroend
