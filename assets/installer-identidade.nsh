; Versões antigas usavam a mesma pasta para as duas edições.
; Redireciona somente o registro da edição instalada, sem executar
; o desinstalador legado: ele poderia apagar a outra edição.
!macro preInit
  !ifndef BUILD_UNINSTALLER
    SetRegView 64
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${GetFileName} "$0" $1
    ${If} $1 == "benindj-hub-app"
      ${GetParent} "$0" $2
      WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$2\${APP_FILENAME}"
      DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
      DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString"
    ${EndIf}
  !endif
!macroend
