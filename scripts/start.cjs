"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const { preparar } = require("./prepare.cjs");
(async () => {
  const perfil = process.argv.includes("--professor") ? "professor" : "aluno";
  await preparar(perfil);
  const filho = spawn(require("electron"), [path.resolve(__dirname, "..")], {
    stdio: "inherit",
    env: { ...process.env, ACAI_PROFILE: perfil },
    windowsHide: true,
  });
  filho.on("exit", (c) => process.exit(c ?? 1));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
