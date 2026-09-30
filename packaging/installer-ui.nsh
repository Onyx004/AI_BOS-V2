!include "WinMessages.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; Shared AI BOS installer presentation (Admin and Employee).
;
; - The installer is DPI-aware, so Windows no longer stretches (blurs) the whole setup window; the window and
;   all artwork are sized from the screen DPI instead.
; - Every page after Welcome gets a branded banner (logo, product name, tagline). The install page shows a
;   large progress bar with the percentage and a four-step tracker (Preparing / Installing files /
;   Configuring / Finalizing). Artwork lives in packaging/assets/installer/ui (generate-installer-ui.ps1).
; - Installation and uninstallation semantics stay in electron-builder and the product hooks. Products move
;   the tracker with `!insertmacro AiBosSetStep <3|4>` (see employee/installer.nsh, admin/installer.nsh).
!define MUI_ABORTWARNING
!define MUI_BGCOLOR "FFFFFF"
!define MUI_TEXTCOLOR "0B2447"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"

!ifdef AIBOS_EMPLOYEE_INSTALLER
  !define AIBOS_KIND "employee"
  !define AIBOS_INSTALLING_SUBTITLE "Please wait while setup installs the application and required services."
  !define AIBOS_STEP3_LABEL "Configuring services"
!else
  !define AIBOS_KIND "admin"
  !define AIBOS_INSTALLING_SUBTITLE "Please wait while setup installs the application."
  !define AIBOS_STEP3_LABEL "Configuring"
!endif
!define AIBOS_UI_DIR "${PROJECT_DIR}\packaging\assets\installer\ui"

; Design size (pixels at 96 DPI) of the setup window's client area and its fixed regions.
!define AIBOS_W 640
!define AIBOS_H 448
!define AIBOS_BANNER_H 84
!define AIBOS_BOTTOM_H 58

!ifndef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_GUIINIT AiBosGuiInit

  Var AiBosDpi
  Var AiBosPx
  Var AiBosW
  Var AiBosH
  Var AiBosBarY
  Var AiBosBanner
  Var AiBosInner
  Var AiBosProgress
  Var AiBosPctLabel
  Var AiBosStep
  Var AiBosDone
  Var AiBosShownStep
  Var AiBosShownPct
  Var AiBosBmpDone
  Var AiBosBmpActive
  Var AiBosBmpTodo
  Var AiBosFontHeading
  Var AiBosFontBody
  Var AiBosFontPercent
  Var AiBosM1
  Var AiBosM2
  Var AiBosM3
  Var AiBosM4
  Var AiBosL1
  Var AiBosL2
  Var AiBosL3
  Var AiBosL4
  Var AiBosLine1
  Var AiBosLine2
  Var AiBosLine3
  Var AiBosCX1
  Var AiBosCX2
  Var AiBosCX3
  Var AiBosCX4
  Var AiBosMarker
  Var AiBosMarkerTop
  Var AiBosLabelTop
  Var AiBosLabelW
  !ifdef AIBOS_DEBUG
    Var AiBosLogH
  !endif
  Var AiBosNsd
  Var AiBosHeading
  Var AiBosDesc
  Var AiBosFailed
  Var AiBosFinalShown
  Var AiBosT1
  Var AiBosT2
  Var AiBosT3
  Var AiBosT4
  Var AiBosT5
  Var AiBosT6

  !macro AiBosLog text
    !ifdef AIBOS_DEBUG
      FileOpen $AiBosLogH "$TEMP\aibos-ui-debug.txt" a
      FileSeek $AiBosLogH 0 END
      FileWrite $AiBosLogH "${text}$\r$\n"
      FileClose $AiBosLogH
    !endif
  !macroend

  !macro AiBosLogRect label hwnd
    !ifdef AIBOS_DEBUG
      Push $0
      Push $1
      Push $2
      Push $3
      Push $4
      Push $9
      System::Call '*(i 0, i 0, i 0, i 0) p .r9'
      System::Call 'user32::GetWindowRect(p ${hwnd}, p r9)'
      System::Call '*$9(i .r1, i .r2, i .r3, i .r4)'
      System::Free $9
      IntOp $3 $3 - $1
      IntOp $4 $4 - $2
      FileOpen $0 "$TEMP\aibos-ui-debug.txt" a
      FileSeek $0 0 END
      FileWrite $0 "${label}: x=$1 y=$2 w=$3 h=$4$\r$\n"
      FileClose $0
      Pop $9
      Pop $4
      Pop $3
      Pop $2
      Pop $1
      Pop $0
    !endif
  !macroend

  ; out = design pixels * DPI / 96
  !macro AiBosPxOf out design
    IntOp ${out} ${design} * $AiBosDpi
    IntOp ${out} ${out} / 96
  !macroend

  !macro AiBosMove hwnd x y w h
    System::Call 'user32::SetWindowPos(p ${hwnd}, p 0, i ${x}, i ${y}, i ${w}, i ${h}, i 0x14)'
  !macroend

  ; Text label, child of `parent`. align: 0 left, 1 centre, 2 right. `color` is RRGGBB.
  !macro AiBosLabel out parent align x y w h text font color
    IntOp ${out} 0x50000080 + ${align}
    System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "${text}", i ${out}, i ${x}, i ${y}, i ${w}, i ${h}, p ${parent}, p 0, p 0, p 0) p .s'
    Pop ${out}
    SendMessage ${out} ${WM_SETFONT} ${font} 1
    SetCtlColors ${out} ${color} FFFFFF
  !macroend

  ; Solid coloured rectangle (used for the tracker lines).
  !macro AiBosBox out parent x y w h color
    System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i 0x50000000, i ${x}, i ${y}, i ${w}, i ${h}, p ${parent}, p 0, p 0, p 0) p .s'
    Pop ${out}
    SetCtlColors ${out} "" ${color}
  !macroend

  !macro AiBosImage out parent x y w h bitmap
    System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i 0x5000000E, i ${x}, i ${y}, i ${w}, i ${h}, p ${parent}, p 0, p 0, p 0) p .s'
    Pop ${out}
    SendMessage ${out} 0x172 0 ${bitmap}
  !macroend

  !macro AiBosFont out heightPx weight face
    System::Call 'gdi32::CreateFont(i -${heightPx}, i 0, i 0, i 0, i ${weight}, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, t "${face}") p .s'
    Pop ${out}
  !macroend

  !macro AiBosLoadBitmap out file
    System::Call 'user32::LoadImage(p 0, t "${file}", i 0, i 0, i 0, i 0x10) p .s'
    Pop ${out}
  !macroend

  ; Extract only the artwork of the current DPI bucket.
  !macro AiBosExtractScale pct
    ${If} $AiBosPx == ${pct}
      File "/oname=$PLUGINSDIR\aibos-banner.bmp" "${AIBOS_UI_DIR}\${AIBOS_KIND}-banner-${pct}.bmp"
      File "/oname=$PLUGINSDIR\aibos-sidebar.bmp" "${AIBOS_UI_DIR}\${AIBOS_KIND}-sidebar-${pct}.bmp"
      File "/oname=$PLUGINSDIR\aibos-step-done.bmp" "${AIBOS_UI_DIR}\step-done-${pct}.bmp"
      File "/oname=$PLUGINSDIR\aibos-step-active.bmp" "${AIBOS_UI_DIR}\step-active-${pct}.bmp"
      File "/oname=$PLUGINSDIR\aibos-step-todo.bmp" "${AIBOS_UI_DIR}\step-todo-${pct}.bmp"
    ${EndIf}
  !macroend

  ; Called by the products: move the tracker to step 3 (configuring) or 4 (finalizing).
  !macro AiBosSetStep step
    StrCpy $AiBosStep ${step}
  !macroend

  ; Called by the products as the very last hook of the install section: shows the completion screen.
  ; (NSIS runs .onInstSuccess only when the window is closed, so completion has to be announced here.)
  !macro AiBosFinished
    StrCpy $AiBosStep 4
    StrCpy $AiBosDone 1
    Call AiBosUpdateUi
  !macroend

  Function AiBosMetrics
    System::Call 'user32::GetDC(p 0) p .s'
    Pop $AiBosT1
    System::Call 'gdi32::GetDeviceCaps(p $AiBosT1, i 88) i .s'
    Pop $AiBosDpi
    System::Call 'user32::ReleaseDC(p 0, p $AiBosT1)'
    ${If} $AiBosDpi < 96
      StrCpy $AiBosDpi 96
    ${EndIf}
    ${If} $AiBosDpi < 108
      StrCpy $AiBosPx 100
    ${ElseIf} $AiBosDpi < 135
      StrCpy $AiBosPx 125
    ${ElseIf} $AiBosDpi < 168
      StrCpy $AiBosPx 150
    ${Else}
      StrCpy $AiBosPx 200
    ${EndIf}
  FunctionEnd

  ; Runs before the first page: size the setup window and its frame (bottom bar, buttons) for the screen DPI.
  Function AiBosGuiInit
    InitPluginsDir
    Call AiBosMetrics
    !insertmacro AiBosExtractScale 100
    !insertmacro AiBosExtractScale 125
    !insertmacro AiBosExtractScale 150
    !insertmacro AiBosExtractScale 200

    !insertmacro AiBosPxOf $AiBosW ${AIBOS_W}
    !insertmacro AiBosPxOf $AiBosH ${AIBOS_H}
    !insertmacro AiBosPxOf $AiBosT1 ${AIBOS_BOTTOM_H}
    IntOp $AiBosBarY $AiBosH - $AiBosT1

    ; window: keep the non-client frame, replace the client size, centre on screen
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $9
    System::Call '*(i 0, i 0, i 0, i 0) p .r9'
    System::Call 'user32::GetWindowRect(p $HWNDPARENT, p r9)'
    System::Call '*$9(i .r1, i .r2, i .r3, i .r4)'
    System::Call 'user32::GetClientRect(p $HWNDPARENT, p r9)'
    System::Call '*$9(i, i, i .r5, i .r6)'
    System::Free $9
    IntOp $3 $3 - $1
    IntOp $4 $4 - $2
    IntOp $3 $3 - $5
    IntOp $4 $4 - $6
    IntOp $3 $3 + $AiBosW ; outer width
    IntOp $4 $4 + $AiBosH ; outer height
    System::Call 'user32::GetSystemMetrics(i 0) i .r1'
    System::Call 'user32::GetSystemMetrics(i 1) i .r2'
    IntOp $1 $1 - $3
    IntOp $1 $1 / 2
    IntOp $2 $2 - $4
    IntOp $2 $2 / 2
    !insertmacro AiBosMove $HWNDPARENT $1 $2 $3 $4
    !ifdef AIBOS_DEBUG
      FileOpen $0 "$TEMP\aibos-ui-debug.txt" w
      FileWrite $0 "dpi=$AiBosDpi bucket=$AiBosPx W=$AiBosW H=$AiBosH barY=$AiBosBarY outer=$3x$4 at $1,$2$\r$\n"
      FileClose $0
    !endif
    Pop $9
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0

    ; wizard areas: full height for Welcome/Finish (1044), below the banner for the other pages (1018)
    GetDlgItem $AiBosT1 $HWNDPARENT 1044
    !insertmacro AiBosMove $AiBosT1 0 0 $AiBosW $AiBosBarY
    !insertmacro AiBosPxOf $AiBosT2 ${AIBOS_BANNER_H}
    IntOp $AiBosT3 $AiBosBarY - $AiBosT2
    GetDlgItem $AiBosT1 $HWNDPARENT 1018
    !insertmacro AiBosMove $AiBosT1 0 $AiBosT2 $AiBosW $AiBosT3

    ; bottom bar: separator, version text, Back / Next / Cancel
    ; MUI's own separators / header leftovers (everything in 1029-1046 except the wizard area 1044)
    StrCpy $AiBosT1 1029
    ${Do}
      ${If} $AiBosT1 <> 1044
        GetDlgItem $AiBosT2 $HWNDPARENT $AiBosT1
        ShowWindow $AiBosT2 0
      ${EndIf}
      IntOp $AiBosT1 $AiBosT1 + 1
    ${LoopUntil} $AiBosT1 > 1046
    !insertmacro AiBosPxOf $AiBosT2 1
    !insertmacro AiBosBox $AiBosT1 $HWNDPARENT 0 $AiBosBarY $AiBosW $AiBosT2 E1E8F0
    !insertmacro AiBosPxOf $AiBosT2 32
    !insertmacro AiBosPxOf $AiBosT3 20
    !insertmacro AiBosPxOf $AiBosT4 19
    IntOp $AiBosT4 $AiBosBarY + $AiBosT4
    !insertmacro AiBosPxOf $AiBosT5 300
    GetDlgItem $AiBosT1 $HWNDPARENT 1028
    !insertmacro AiBosMove $AiBosT1 $AiBosT2 $AiBosT4 $AiBosT5 $AiBosT3

    !insertmacro AiBosPxOf $AiBosT2 88   ; button width
    !insertmacro AiBosPxOf $AiBosT3 28   ; button height
    !insertmacro AiBosPxOf $AiBosT5 16   ; right margin
    !insertmacro AiBosPxOf $AiBosT6 8    ; gap
    !insertmacro AiBosPxOf $AiBosT4 15
    IntOp $AiBosT4 $AiBosBarY + $AiBosT4 ; button top
    IntOp $AiBosT1 $AiBosW - $AiBosT5
    IntOp $AiBosT1 $AiBosT1 - $AiBosT2   ; Cancel x
    GetDlgItem $AiBosInner $HWNDPARENT 2
    !insertmacro AiBosMove $AiBosInner $AiBosT1 $AiBosT4 $AiBosT2 $AiBosT3
    IntOp $AiBosT1 $AiBosT1 - $AiBosT6
    IntOp $AiBosT1 $AiBosT1 - $AiBosT2   ; Next x
    GetDlgItem $AiBosInner $HWNDPARENT 1
    !insertmacro AiBosMove $AiBosInner $AiBosT1 $AiBosT4 $AiBosT2 $AiBosT3
    IntOp $AiBosT1 $AiBosT1 - $AiBosT6
    IntOp $AiBosT1 $AiBosT1 - $AiBosT2   ; Back x
    GetDlgItem $AiBosInner $HWNDPARENT 3
    !insertmacro AiBosMove $AiBosInner $AiBosT1 $AiBosT4 $AiBosT2 $AiBosT3

    ; banner, created once and shown/hidden per page
    !insertmacro AiBosLoadBitmap $AiBosT1 "$PLUGINSDIR\aibos-banner.bmp"
    !insertmacro AiBosPxOf $AiBosT2 ${AIBOS_BANNER_H}
    !insertmacro AiBosImage $AiBosBanner $HWNDPARENT 0 0 $AiBosW $AiBosT2 $AiBosT1
    ShowWindow $AiBosBanner 0

    !insertmacro AiBosLoadBitmap $AiBosBmpDone "$PLUGINSDIR\aibos-step-done.bmp"
    !insertmacro AiBosLoadBitmap $AiBosBmpActive "$PLUGINSDIR\aibos-step-active.bmp"
    !insertmacro AiBosLoadBitmap $AiBosBmpTodo "$PLUGINSDIR\aibos-step-todo.bmp"

    SetCtlColors $HWNDPARENT "" FFFFFF
    GetDlgItem $AiBosT1 $HWNDPARENT 1028
    SetCtlColors $AiBosT1 5B6675 FFFFFF
  FunctionEnd

  ; Header pages (folder choice, install progress): show the banner instead of the small MUI header.
  Function AiBosBannerPageShow
    ShowWindow $AiBosBanner 5
    StrCpy $AiBosT1 1034
    ${Do}
      GetDlgItem $AiBosT2 $HWNDPARENT $AiBosT1
      ShowWindow $AiBosT2 0
      IntOp $AiBosT1 $AiBosT1 + 1
    ${LoopUntil} $AiBosT1 > 1039
  FunctionEnd

  ; One step of the tracker: marker picture + label, centred on `permille` of the page width.
  !macro AiBosStepUi n permille label
    IntOp $AiBosCX${n} $AiBosW * ${permille}
    IntOp $AiBosCX${n} $AiBosCX${n} / 1000
    IntOp $AiBosT3 $AiBosMarker / 2
    IntOp $AiBosT3 $AiBosCX${n} - $AiBosT3
    !insertmacro AiBosImage $AiBosM${n} $AiBosInner $AiBosT3 $AiBosMarkerTop $AiBosMarker $AiBosMarker $AiBosBmpTodo
    IntOp $AiBosT3 $AiBosLabelW / 2
    IntOp $AiBosT3 $AiBosCX${n} - $AiBosT3
    !insertmacro AiBosPxOf $AiBosT4 22
    !insertmacro AiBosLabel $AiBosL${n} $AiBosInner 1 $AiBosT3 $AiBosLabelTop $AiBosLabelW $AiBosT4 "${label}" $AiBosFontBody 8A94A3
  !macroend

  ; Line between step n and step `next`.
  !macro AiBosLineUi n next
    !insertmacro AiBosPxOf $AiBosT1 6
    IntOp $AiBosT2 $AiBosMarker / 2
    IntOp $AiBosT1 $AiBosT1 + $AiBosT2
    IntOp $AiBosT3 $AiBosCX${n} + $AiBosT1
    IntOp $AiBosT4 $AiBosCX${next} - $AiBosT1
    IntOp $AiBosT4 $AiBosT4 - $AiBosT3
    IntOp $AiBosT5 $AiBosMarker / 2
    IntOp $AiBosT5 $AiBosMarkerTop + $AiBosT5
    !insertmacro AiBosPxOf $AiBosT6 1
    IntOp $AiBosT5 $AiBosT5 - $AiBosT6
    !insertmacro AiBosPxOf $AiBosT6 2
    !insertmacro AiBosBox $AiBosLine${n} $AiBosInner $AiBosT3 $AiBosT5 $AiBosT4 $AiBosT6 C9CFD8
  !macroend

  ; Marker picture, label colour and the line that follows step n, for the current step in $AiBosT4.
  !macro AiBosApplyStep n
    ${If} $AiBosT4 > ${n}
      SendMessage $AiBosM${n} 0x172 0 $AiBosBmpDone
      SetCtlColors $AiBosL${n} 0B2447 FFFFFF
    ${ElseIf} $AiBosT4 = ${n}
      SendMessage $AiBosM${n} 0x172 0 $AiBosBmpActive
      SetCtlColors $AiBosL${n} 1677E5 FFFFFF
    ${Else}
      SendMessage $AiBosM${n} 0x172 0 $AiBosBmpTodo
      SetCtlColors $AiBosL${n} 8A94A3 FFFFFF
    ${EndIf}
    System::Call 'user32::InvalidateRect(p $AiBosL${n}, p 0, i 1)'
    !if ${n} < 4
      ${If} $AiBosT4 > ${n}
        SetCtlColors $AiBosLine${n} "" 1677E5
      ${Else}
        SetCtlColors $AiBosLine${n} "" C9CFD8
      ${EndIf}
      System::Call 'user32::InvalidateRect(p $AiBosLine${n}, p 0, i 1)'
    !endif
  !macroend

  ; Folder-choice page: banner on top, content stretched to the wider window with side margins.
  Function AiBosDirPageShow
    Call AiBosBannerPageShow
    FindWindow $AiBosInner "#32770" "" $HWNDPARENT
    !insertmacro AiBosPxOf $AiBosT5 32
    !insertmacro AiBosPxOf $AiBosT2 ${AIBOS_BANNER_H}
    !insertmacro AiBosPxOf $AiBosT1 16
    IntOp $AiBosT2 $AiBosT2 + $AiBosT1
    IntOp $AiBosT3 $AiBosW - $AiBosT5
    IntOp $AiBosT3 $AiBosT3 - $AiBosT5
    IntOp $AiBosT4 $AiBosBarY - $AiBosT2
    !insertmacro AiBosMove $AiBosInner $AiBosT5 $AiBosT2 $AiBosT3 $AiBosT4
    SetCtlColors $AiBosInner "" FFFFFF
    StrCpy $AiBosLabelW $AiBosT3 ; inner width

    GetDlgItem $AiBosT1 $AiBosInner 1006
    !insertmacro AiBosPxOf $AiBosT2 50
    !insertmacro AiBosMove $AiBosT1 0 0 $AiBosLabelW $AiBosT2
    SetCtlColors $AiBosT1 0B2447 FFFFFF

    GetDlgItem $AiBosT1 $AiBosInner 1020
    !insertmacro AiBosPxOf $AiBosT2 64
    !insertmacro AiBosPxOf $AiBosT3 78
    !insertmacro AiBosMove $AiBosT1 0 $AiBosT2 $AiBosLabelW $AiBosT3
    SetCtlColors $AiBosT1 0B2447 FFFFFF

    !insertmacro AiBosPxOf $AiBosT5 16
    !insertmacro AiBosPxOf $AiBosT6 104
    IntOp $AiBosT4 $AiBosLabelW - $AiBosT5
    IntOp $AiBosT4 $AiBosT4 - $AiBosT6 ; browse x
    GetDlgItem $AiBosT1 $AiBosInner 1001
    !insertmacro AiBosPxOf $AiBosT2 94
    !insertmacro AiBosPxOf $AiBosT3 32
    !insertmacro AiBosMove $AiBosT1 $AiBosT4 $AiBosT2 $AiBosT6 $AiBosT3

    !insertmacro AiBosPxOf $AiBosT6 8
    IntOp $AiBosT4 $AiBosT4 - $AiBosT6
    IntOp $AiBosT4 $AiBosT4 - $AiBosT5 ; edit width
    GetDlgItem $AiBosT1 $AiBosInner 1019
    !insertmacro AiBosPxOf $AiBosT2 96
    !insertmacro AiBosPxOf $AiBosT3 28
    !insertmacro AiBosMove $AiBosT1 $AiBosT5 $AiBosT2 $AiBosT4 $AiBosT3

    GetDlgItem $AiBosT1 $AiBosInner 1023
    !insertmacro AiBosPxOf $AiBosT2 158
    !insertmacro AiBosPxOf $AiBosT3 22
    !insertmacro AiBosMove $AiBosT1 0 $AiBosT2 $AiBosLabelW $AiBosT3
    SetCtlColors $AiBosT1 5B6675 FFFFFF
    GetDlgItem $AiBosT1 $AiBosInner 1024
    !insertmacro AiBosPxOf $AiBosT2 184
    !insertmacro AiBosMove $AiBosT1 0 $AiBosT2 $AiBosLabelW $AiBosT3
    SetCtlColors $AiBosT1 5B6675 FFFFFF
  FunctionEnd

  Function AiBosInstallPageShow
    !insertmacro AiBosLog "install-show: enter"
    Call AiBosBannerPageShow
    !insertmacro AiBosLog "install-show: banner done"

    ; inner dialog (holds the native progress bar); hide the native status text, log and details button
    FindWindow $AiBosInner "#32770" "" $HWNDPARENT
    !insertmacro AiBosPxOf $AiBosT2 ${AIBOS_BANNER_H}
    IntOp $AiBosT3 $AiBosBarY - $AiBosT2
    !insertmacro AiBosMove $AiBosInner 0 $AiBosT2 $AiBosW $AiBosT3
    SetCtlColors $AiBosInner "" FFFFFF
    GetDlgItem $AiBosProgress $AiBosInner 1004
    GetDlgItem $AiBosT1 $AiBosInner 1006
    ShowWindow $AiBosT1 0
    GetDlgItem $AiBosT1 $AiBosInner 1016
    ShowWindow $AiBosT1 0
    GetDlgItem $AiBosT1 $AiBosInner 1027
    ShowWindow $AiBosT1 0

    !insertmacro AiBosLog "install-show: controls hidden"
    !insertmacro AiBosLogRect "outer" $HWNDPARENT
    !insertmacro AiBosLogRect "inner" $AiBosInner
    GetDlgItem $AiBosT1 $HWNDPARENT 1018
    !insertmacro AiBosLogRect "child-rect-1018" $AiBosT1
    ; fonts (pixel heights scale with DPI)
    !insertmacro AiBosPxOf $AiBosT1 22
    !insertmacro AiBosFont $AiBosFontHeading $AiBosT1 600 "Segoe UI Semibold"
    !insertmacro AiBosPxOf $AiBosT1 14
    !insertmacro AiBosFont $AiBosFontBody $AiBosT1 400 "Segoe UI"
    !insertmacro AiBosPxOf $AiBosT1 18
    !insertmacro AiBosFont $AiBosFontPercent $AiBosT1 600 "Segoe UI Semibold"

    !insertmacro AiBosLog "install-show: fonts made"
    ; heading + description
    !insertmacro AiBosPxOf $AiBosT1 32
    !insertmacro AiBosPxOf $AiBosT2 28
    IntOp $AiBosT3 $AiBosW - $AiBosT1
    IntOp $AiBosT3 $AiBosT3 - $AiBosT1
    !insertmacro AiBosPxOf $AiBosT4 34
    !insertmacro AiBosLabel $AiBosHeading $AiBosInner 0 $AiBosT1 $AiBosT2 $AiBosT3 $AiBosT4 "Installing ${PRODUCT_NAME}" $AiBosFontHeading 0B2447
    !insertmacro AiBosPxOf $AiBosT2 68
    !insertmacro AiBosPxOf $AiBosT4 24
    !insertmacro AiBosLabel $AiBosDesc $AiBosInner 0 $AiBosT1 $AiBosT2 $AiBosT3 $AiBosT4 "${AIBOS_INSTALLING_SUBTITLE}" $AiBosFontBody 5B6675

    !insertmacro AiBosLog "install-show: heading made"
    ; progress bar + percentage
    !insertmacro AiBosPxOf $AiBosT2 76
    IntOp $AiBosT4 $AiBosT3 - $AiBosT2
    !insertmacro AiBosPxOf $AiBosT2 112
    !insertmacro AiBosPxOf $AiBosT5 22
    !insertmacro AiBosMove $AiBosProgress $AiBosT1 $AiBosT2 $AiBosT4 $AiBosT5
    System::Call 'UxTheme::SetWindowTheme(p $AiBosProgress, w "", w "")'
    SendMessage $AiBosProgress ${PBM_SETBARCOLOR} 0 0x00E57716
    SendMessage $AiBosProgress ${PBM_SETBKCOLOR} 0 0x00F6EEE7
    IntOp $AiBosT4 $AiBosW - $AiBosT1
    !insertmacro AiBosPxOf $AiBosT5 64
    IntOp $AiBosT4 $AiBosT4 - $AiBosT5
    !insertmacro AiBosPxOf $AiBosT2 106
    !insertmacro AiBosPxOf $AiBosT6 34
    !insertmacro AiBosLabel $AiBosPctLabel $AiBosInner 2 $AiBosT4 $AiBosT2 $AiBosT5 $AiBosT6 "0%" $AiBosFontPercent 1677E5

    !insertmacro AiBosLog "install-show: progress made"
    ; step tracker: four markers with a line between each, labels underneath
    !insertmacro AiBosPxOf $AiBosMarker 22
    !insertmacro AiBosPxOf $AiBosMarkerTop 178
    !insertmacro AiBosPxOf $AiBosLabelTop 210
    !insertmacro AiBosPxOf $AiBosLabelW 150
    !insertmacro AiBosStepUi 1 150 "Preparing"
    !insertmacro AiBosStepUi 2 383 "Installing files"
    !insertmacro AiBosStepUi 3 617 "${AIBOS_STEP3_LABEL}"
    !insertmacro AiBosStepUi 4 850 "Finalizing"
    !insertmacro AiBosLineUi 1 2
    !insertmacro AiBosLineUi 2 3
    !insertmacro AiBosLineUi 3 4

    !insertmacro AiBosLog "install-show: stepper made"
    StrCpy $AiBosStep 1
    StrCpy $AiBosDone 0
    StrCpy $AiBosFailed 0
    StrCpy $AiBosFinalShown 0
    StrCpy $AiBosShownStep 0
    StrCpy $AiBosShownPct -1
    Call AiBosUpdateUi
    !insertmacro AiBosLog "install-show: ui updated"
    !ifndef AIBOS_NO_TIMER
    nsDialogs::Create 1018
    Pop $AiBosNsd
    ShowWindow $AiBosNsd 0
    ${NSD_CreateTimer} AiBosTick 120
    !endif
    !insertmacro AiBosLog "install-show: done"
  FunctionEnd

  Function AiBosInstallPageLeave
    !insertmacro AiBosLog "install-leave"
    !ifndef AIBOS_NO_TIMER
    ${NSD_KillTimer} AiBosTick
    !endif
    !ifndef HIDE_RUN_AFTER_FINISH
      ${If} $AiBosDone = 1
      ${AndIfNot} ${Silent}
        Call AiBosLaunchApp
      ${EndIf}
    !endif
  FunctionEnd

  ; NSIS stops running timer callbacks once the install thread ends, so the final state is applied right here.
  Function .onInstFailed
    StrCpy $AiBosFailed 1
    Call AiBosUpdateUi
  FunctionEnd



  ; Timer callback (UI thread, via nsDialogs). Only touches the AiBos* variables, never the installer registers.
  Function AiBosTick
    Call AiBosUpdateUi
  FunctionEnd

  Function AiBosUpdateUi
    ${If} $AiBosPctLabel == ""
      Return
    ${EndIf}
    SendMessage $AiBosProgress 0x408 0 0 $AiBosT1 ; PBM_GETPOS
    SendMessage $AiBosProgress 0x407 0 0 $AiBosT2 ; PBM_GETRANGE (upper limit)
    ${If} $AiBosT2 <= 0
      StrCpy $AiBosT2 100
    ${EndIf}
    IntOp $AiBosT3 $AiBosT1 * 100
    IntOp $AiBosT3 $AiBosT3 / $AiBosT2
    ${If} $AiBosDone = 1
      StrCpy $AiBosT3 100
    ${EndIf}
    ${If} $AiBosT3 <> $AiBosShownPct
      StrCpy $AiBosShownPct $AiBosT3
      SendMessage $AiBosPctLabel ${WM_SETTEXT} 0 "STR:$AiBosT3%"
    ${EndIf}

    ; current step: 1 until data is flowing, 2 while extracting, then whatever the product reports
    ${If} $AiBosDone = 1
      StrCpy $AiBosT4 5
    ${ElseIf} $AiBosStep >= 3
      StrCpy $AiBosT4 $AiBosStep
    ${ElseIf} $AiBosT1 > 0
      StrCpy $AiBosT4 2
    ${Else}
      StrCpy $AiBosT4 1
    ${EndIf}
    ${If} $AiBosDone = 1
    ${AndIf} $AiBosFinalShown = 0
      StrCpy $AiBosFinalShown 1
      SendMessage $AiBosHeading ${WM_SETTEXT} 0 "STR:${PRODUCT_NAME} is ready"
      !ifdef HIDE_RUN_AFTER_FINISH
        SendMessage $AiBosDesc ${WM_SETTEXT} 0 "STR:Installation completed successfully. Select Close to finish."
      !else
        SendMessage $AiBosDesc ${WM_SETTEXT} 0 "STR:Installation completed successfully. Select Close to open ${PRODUCT_NAME}."
      !endif
    ${ElseIf} $AiBosFailed = 1
    ${AndIf} $AiBosFinalShown = 0
      StrCpy $AiBosFinalShown 1
      SendMessage $AiBosHeading ${WM_SETTEXT} 0 "STR:Installation could not be completed"
      SendMessage $AiBosDesc ${WM_SETTEXT} 0 "STR:Setup stopped before finishing. Close setup and try again, or contact your administrator."
    ${EndIf}
    ${If} $AiBosT4 <> $AiBosShownStep
      StrCpy $AiBosShownStep $AiBosT4
      !insertmacro AiBosApplyStep 1
      !insertmacro AiBosApplyStep 2
      !insertmacro AiBosApplyStep 3
      !insertmacro AiBosApplyStep 4
    ${EndIf}
  FunctionEnd
!endif

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    ManifestDPIAware true
  !endif
  SetFont "Segoe UI" 9
  BrandingText "${PRODUCT_NAME} ${VERSION}"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Enterprise AI Management Platform$\r$\n$\r$\nSetup will install ${PRODUCT_NAME} on this computer.$\r$\n$\r$\nSelect Next to continue."
  !ifndef BUILD_UNINSTALLER
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW AiBosWelcomePageShow
  !endif
  !insertmacro MUI_PAGE_WELCOME
  !ifndef BUILD_UNINSTALLER
  Function AiBosWelcomePageShow
    ShowWindow $AiBosBanner 0
    ; the MUI sidebar picture is a fixed 164x314 bitmap: swap in the one made for this DPI and stretch it to the page
    Push $0
    Push $1
    Push $2
    System::Call '*(i 0, i 0, i 0, i 0) p .r2'
    System::Call 'user32::GetWindowRect(p $mui.WelcomePage.Image, p r2)'
    System::Call '*$2(i .r0, i, i .r1, i)'
    System::Free $2
    StrCpy $AiBosT1 $0
    StrCpy $AiBosT2 $1
    Pop $2
    Pop $1
    Pop $0
    IntOp $AiBosT2 $AiBosT2 - $AiBosT1 ; current sidebar width
    System::Call 'user32::GetWindowLong(p $mui.WelcomePage.Image, i -16) i .s'
    Pop $AiBosT3
    IntOp $AiBosT3 $AiBosT3 | 0x40 ; SS_REALSIZECONTROL: stretch the picture to the control
    System::Call 'user32::SetWindowLong(p $mui.WelcomePage.Image, i -16, i $AiBosT3)'
    !insertmacro AiBosMove $mui.WelcomePage.Image 0 0 $AiBosT2 $AiBosBarY
    ${NSD_SetImage} $mui.WelcomePage.Image "$PLUGINSDIR\aibos-sidebar.bmp" $mui.WelcomePage.Image.Bitmap
  FunctionEnd
  !endif
  ; the folder-choice page that follows is inserted by electron-builder; give it the banner too
  !ifndef BUILD_UNINSTALLER
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW AiBosDirPageShow
  !endif
!macroend

!macro customPageAfterChangeDir
  ; These settings are consumed by the immediately following install-files page.
  !define MUI_PAGE_HEADER_TEXT "Installing ${PRODUCT_NAME}"
  !define MUI_PAGE_HEADER_SUBTEXT "${AIBOS_INSTALLING_SUBTITLE}"
  !ifndef BUILD_UNINSTALLER
    !ifdef MUI_PAGE_CUSTOMFUNCTION_SHOW
      !undef MUI_PAGE_CUSTOMFUNCTION_SHOW
    !endif
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW AiBosInstallPageShow
    !define MUI_PAGE_CUSTOMFUNCTION_LEAVE AiBosInstallPageLeave
  !endif
!macroend

!macro customFinishPage
  ; The install page doubles as the completion screen (heading turns into "... is ready", Next becomes Finish),
  ; so there is no separate MUI finish page.  Closing a successful install launches the app, like the old
  ; "Launch" checkbox did.
  Function AiBosLaunchApp
    ${if} ${isUpdated}
      StrCpy $AiBosT1 "--updated"
    ${else}
      StrCpy $AiBosT1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$AiBosT1"
  FunctionEnd
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Remove ${PRODUCT_NAME}"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "This wizard will remove ${PRODUCT_NAME} from this computer.$\r$\n$\r$\nSelect Next to continue."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
