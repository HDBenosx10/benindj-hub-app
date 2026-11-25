"use strict";
const path = require("node:path");
const { build, Platform, Arch } = require("electron-builder");
const { preparar } = require("./prepare.cjs");
process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL ??= "3";
(async () => {
  const professor = process.argv.includes("--professor");
  const perfil = professor ? "professor" : "aluno";
  const identidade = require("../desktop/identidade.cjs").identidade(perfil);
  const privado = path.resolve(__dirname, "../../benindj-hub-professor");
  const raiz = path.resolve(__dirname, "..");
  const base = await preparar(perfil, privado);
  const titulo = professor ? "Professor" : "Aluno";
  await build({
    targets: Platform.WINDOWS.createTarget(
      process.argv.includes("--dir") ? ["dir"] : ["nsis", "portable"],
      Arch.x64,
    ),
    publish: "never",
    config: {
      appId: identidade.appId,
      productName: identidade.nome,
      electronVersion: require("../package.json").devDependencies.electron,
      asar: true,
      publish: professor
        ? {
            provider: "generic",
            url: process.env.HUB_SERVICE_URL || "https://updates.invalid/",
          }
        : { provider: "github", owner: "HDBenosx10", repo: "benindj-hub-app" },
      files: ["desktop/**/*", "engine/percurso.js", "package.json"],
      directories: {
        app: raiz,
        output: path.join(professor ? privado : raiz, "dist"),
      },
      extraResources: [
        { from: path.join(base, "backend"), to: "backend" },
        { from: path.join(base, "runtime"), to: "runtime" },
      ],
      extraMetadata: {
        name: identidade.nomeInterno,
        hubPerfil: perfil,
        version: process.env.HUB_RELEASE_VERSION
          ? require("./release-version.cjs").validarVersao(
              process.env.HUB_RELEASE_VERSION,
            )
          : professor
            ? require(path.join(privado, "package.json")).version
            : require("../package.json").version,
      },
      win: {
        signAndEditExecutable: true,
        signExecutable: false,
        // Os binários são conferidos pelo manifesto Ed25519 fixado no aplicativo.
        verifyUpdateCodeSignature: false,
        icon: path.join(raiz, "assets", "app.ico"),
        target: ["nsis", "portable"],
      },
      portable: {
        artifactName: "BeninDJ-Hub-" + titulo + "-${version}-Windows-x64.exe",
      },
      nsis: {
        include: path.join(raiz, "assets", "installer-identidade.nsh"),
        artifactName:
          "BeninDJ-Hub-" + titulo + "-${version}-Instalador-Windows-x64.exe",
        oneClick: true,
        perMachine: false,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        deleteAppDataOnUninstall: false,
      },
      fileAssociations: professor
        ? []
        : [
            {
              ext: "trilha-hub",
              name: "Planejamento de trilha do BeninDJ Hub",
              description: "Metadados da trilha, sem conteúdo de aulas",
              role: "Editor",
            },
            {
              ext: "aulas-hub",
              name: "Pacote de aulas do BeninDJ Hub",
              description: "Aulas selecionadas pelo professor",
              role: "Editor",
            },
            {
              ext: "aula-hub",
              name: "Aula do BeninDJ Hub",
              description: "Aula liberada pelo professor",
              role: "Editor",
            },
          ],
    },
  });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
