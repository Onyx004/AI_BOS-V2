!define AIBOS_ADMIN_INSTALLER
!include "${PROJECT_DIR}\packaging\installer-ui.nsh"

!macro customInstall
  !insertmacro AiBosSetStep 3
  !insertmacro AiBosSetStep 4
  !insertmacro AiBosFinished
!macroend
