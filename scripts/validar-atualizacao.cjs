"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
(async () => {
  const repo = "HDBenosx10/benindj-hub-app";
  const release = await (
    await fetch(`https://api.github.com/repos/${repo}/releases/tags/v0.9.0`)
  ).json();
  const artefato = release.assets?.find(
    (a) => a.name === "BeninDJ-Hub-Aluno-0.9.0-Windows-x64.exe",
  );
  if (!artefato?.digest?.startsWith("sha256:"))
    throw Error("A versão anterior não tem artefato com checksum verificável.");
  const resposta = await fetch(artefato.browser_download_url);
  if (!resposta.ok)
    throw Error(
      "Falha ao obter a versão anterior para o teste de atualização.",
    );
  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (
    "sha256:" + createHash("sha256").update(bytes).digest("hex") !==
    artefato.digest
  )
    throw Error("Checksum da versão anterior não confere.");
  const pasta = path.resolve(__dirname, "../.cache");
  await fs.mkdir(pasta, { recursive: true });
  const executavelAnterior = path.join(
    pasta,
    "aluno-0.9.0-compatibilidade.exe",
  );
  await fs.writeFile(executavelAnterior, bytes);
  try {
    execFileSync(
      process.execPath,
      [
        path.join(__dirname, "smoke-desktop.cjs"),
        path.resolve("dist/win-unpacked/BeninDJ Hub Aluno.exe"),
        executavelAnterior,
      ],
      {
        stdio: "inherit",
        windowsHide: true,
        timeout: 240000,
        env: { ...process.env, HUB_PROFILE: "aluno" },
      },
    );
  } finally {
    await fs.rm(executavelAnterior, { force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
