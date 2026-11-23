"use strict";
const path = require("node:path");
const { build, Platform, Arch } = require("electron-builder");
const { preparar } = require("./prepare.cjs");
process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL ??= "3";
(async () => {
  const professor = process.argv.includes("--professor");
  const perfil = professor ? "professor" : "aluno";
  const privado = path.resolve(__dirname, "../../atelie-acai-professor");
  const raiz = path.resolve(__dirname, "..");
  const base = await preparar(perfil, privado);
  const titulo = professor ? "Professor" : "Aluno";
  await build({
    targets: Platform.WINDOWS.createTarget(
      process.argv.includes("--dir") ? ["dir"] : ["portable"],
      Arch.x64,
    ),
    publish: "never",
    config: {
      appId: "br.atelieacai." + perfil,
      productName: "Atelie Acai " + titulo,
      electronVersion: require("../package.json").devDependencies.electron,
      asar: true,
      files: ["desktop/**/*", "package.json"],
      directories: { app: raiz, output: path.join(professor ? privado : raiz, "dist") },
      extraResources: [
        { from: path.join(base, "backend"), to: "backend" },
        { from: path.join(base, "runtime"), to: "runtime" },
      ],
      extraMetadata: {
        acaiPerfil: perfil,
        version: professor
          ? require(path.join(privado, "package.json")).version
          : require("../package.json").version,
      },
      win: {
        signAndEditExecutable: true,
        signExecutable: false,
        icon: path.join(raiz, "assets", "app.ico"),
        target: "portable",
      },
      portable: {
        artifactName: "Atelie-Acai-" + titulo + "-${version}-Windows-x64.exe",
      },
      fileAssociations: [
        {
          ext: "aula-acai",
          name: "Aula do Ateliê Açaí",
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
