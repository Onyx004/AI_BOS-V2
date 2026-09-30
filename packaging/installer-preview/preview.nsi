; Developer-only preview of the AI BOS installer look. Compiles a throw-away installer that copies dummy
; files to %TEMP%, so the real installer UI (packaging/installer-ui.nsh) can be checked without installing the app.
Unicode true
SetCompress off
!include "MUI2.nsh"
!include "LogicLib.nsh"

!ifndef PRODUCT_NAME
  !define PRODUCT_NAME "AI BOS Employee"
!endif
!ifndef VERSION
  !define VERSION "1.0.7"
!endif
!ifndef APP_KIND
  !define APP_KIND "employee"
!endif
!if "${APP_KIND}" == "employee"
  !define AIBOS_EMPLOYEE_INSTALLER
!endif
!define PROJECT_DIR "${__FILEDIR__}\..\.."
!define APP_FILENAME "AI BOS"

; stand-ins for what electron-builder provides around the custom include
Var launchLink
!macro _isUpdated _a _b _t _f
  StrCmp "" "1" `${_t}` `${_f}`
!macroend
!define isUpdated `"" isUpdated ""`
!macro _StubExec _r _a _b _c
!macroend
!define StdUtils.ExecShellAsUser "!insertmacro _StubExec"

Name "${PRODUCT_NAME}"
OutFile "preview-${APP_KIND}.exe"
RequestExecutionLevel user
InstallDir "$TEMP\aibos-preview-install"
ShowInstDetails show

!define MUI_ICON "..\assets\icons\AI-BOS-${APP_KIND}.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "..\assets\installer\${APP_KIND}-header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "..\assets\installer\${APP_KIND}-sidebar.bmp"

!include "..\installer-ui.nsh"

!insertmacro customWelcomePage
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro customPageAfterChangeDir
!insertmacro MUI_PAGE_INSTFILES
!insertmacro customFinishPage
!insertmacro MUI_LANGUAGE "English"
!insertmacro customHeader

Section "Install"
  SetOutPath $INSTDIR
  Sleep 1500
  File /r "payload\a\*.*"
  Sleep 2500
  File /r "payload\b\*.*"
  Sleep 2500
  !insertmacro AiBosSetStep 3
  Sleep 3000
  !insertmacro AiBosSetStep 4
  Sleep 2500
  File /r "payload\c\*.*"
  !insertmacro AiBosFinished
SectionEnd
