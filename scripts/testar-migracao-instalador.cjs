const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
(async () => {
  const dir = await fs.mkdtemp(
    path.join(require("node:os").tmpdir(), "hub-nsis-coexistencia-"),
  );
  const cache =
    process.env.ELECTRON_BUILDER_CACHE ||
    path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache");
  let compiler;
  for (const raiz of (await fs.readdir(cache)).filter((n) =>
    n.startsWith("nsis-"),
  )) {
    for (const item of await fs.readdir(path.join(cache, raiz))) {
      const p = path.join(cache, raiz, item, "Bin", "makensis.exe");
      try {
        await fs.access(p);
        compiler = p;
        break;
      } catch {}
    }
    if (compiler) break;
  }
  if (!compiler)
    throw Error(
      "Compile um instalador primeiro para obter o compilador NSIS em cache.",
    );
  for (const perfil of ["aluno", "professor"]) {
    const raiz = "Software\\BeninDJHubQA\\" + crypto.randomUUID(),
      exe = path.join(dir, perfil + ".exe");
    const script = `Unicode true
Name "Teste isolado de identidade"
OutFile "${exe}"
RequestExecutionLevel user
SilentInstall silent
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!define INSTALL_REGISTRY_KEY "${raiz}\\instalacao"
!define UNINSTALL_REGISTRY_KEY "${raiz}\\desinstalacao"
!define APP_FILENAME "benindj-hub-${perfil}"
!include "${path.resolve("assets/installer-identidade.nsh")}"
Section
 SetRegView 64
 WriteRegStr HKCU "${raiz}\\outra-edicao" "preservar" "intacto"
 WriteRegStr HKCU "\${INSTALL_REGISTRY_KEY}" "InstallLocation" "$TEMP\\QA-Coexistencia\\benindj-hub-app"
 WriteRegStr HKCU "\${UNINSTALL_REGISTRY_KEY}" "UninstallString" "nao-executar-legado"
 WriteRegStr HKCU "\${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString" "nao-executar-legado"
 !insertmacro preInit
 ReadRegStr $0 HKCU "\${INSTALL_REGISTRY_KEY}" "InstallLocation"
 StrCmp $0 "$TEMP\\QA-Coexistencia\\benindj-hub-${perfil}" 0 falhou
 ReadRegStr $0 HKCU "\${UNINSTALL_REGISTRY_KEY}" "UninstallString"
 StrCmp $0 "" 0 falhou
 ReadRegStr $0 HKCU "\${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString"
 StrCmp $0 "" 0 falhou
 ReadRegStr $0 HKCU "${raiz}\\outra-edicao" "preservar"
 StrCmp $0 "intacto" 0 falhou
 WriteRegStr HKCU "\${UNINSTALL_REGISTRY_KEY}" "UninstallString" "desinstalador-novo"
 !insertmacro preInit
 ReadRegStr $0 HKCU "\${UNINSTALL_REGISTRY_KEY}" "UninstallString"
 StrCmp $0 "desinstalador-novo" 0 falhou
 WriteRegStr HKCU "\${INSTALL_REGISTRY_KEY}" "InstallLocation" "$TEMP\\Personalizado"
 !insertmacro preInit
 ReadRegStr $0 HKCU "\${INSTALL_REGISTRY_KEY}" "InstallLocation"
 StrCmp $0 "$TEMP\\Personalizado" 0 falhou
 DeleteRegKey HKCU "${raiz}"
 SetErrorLevel 0
 Goto fim
 falhou:
 DeleteRegKey HKCU "${raiz}"
 SetErrorLevel 1
 fim:
SectionEnd
`;
    const arquivo = path.join(dir, perfil + ".nsi");
    await fs.writeFile(arquivo, script.replaceAll('"\\${', '"${'));
    execFileSync(compiler, ["/V2", arquivo], {
      windowsHide: true,
      stdio: "pipe",
    });
    execFileSync(exe, ["/S"], {
      windowsHide: true,
      stdio: "pipe",
      timeout: 20000,
    });
    console.log(
      "Migração NSIS aprovada: " +
        perfil +
        ", pasta separada, sem executar desinstalador compartilhado, outra edição e caminhos personalizados preservados.",
    );
  }
  await fs.rm(dir, { recursive: true, force: true });
})().catch((e) => {
  console.error(e.message, e.stdout?.toString(), e.stderr?.toString());
  process.exitCode = 1;
});
