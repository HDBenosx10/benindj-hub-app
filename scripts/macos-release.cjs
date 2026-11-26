"use strict";
const fs = require("node:fs/promises");
const sync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
(async () => {
  const perfil = process.env.HUB_PROFILE;
  if (process.platform !== "darwin" || !["aluno", "professor"].includes(perfil)) throw Error("Ambiente macOS inválido.");
  const versao = require("./release-version.cjs").validarVersao(process.env.HUB_RELEASE_VERSION);
  const titulo = perfil === "professor" ? "Professor" : "Aluno";
  const prefixo = `BeninDJ-Hub-${titulo}-${versao}-macOS-${process.arch}`;
  const arquivos = [];
  for (const ext of ["dmg", "zip"]) {
    const nome = prefixo + "." + ext;
    const arquivo = path.resolve("dist", nome);
    const h = crypto.createHash("sha256");
    for await (const parte of sync.createReadStream(arquivo)) h.update(parte);
    arquivos.push({ nome, tamanho: (await fs.stat(arquivo)).size, sha256: h.digest("hex") });
  }
  const commit = dir => execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const manifesto = JSON.stringify({ schema: 1, perfil, versao, plataforma: "darwin", arquitetura: process.arch,
    assinaturaApple: "ad-hoc", notarizado: false, updater: "manual", commit: commit(process.cwd()),
    motorCommit: commit(path.resolve(__dirname, "..")), arquivos }, null, 2) + "\n";
  const assinatura = crypto.sign(null, Buffer.from(manifesto), process.env.HUB_UPDATE_PRIVATE_KEY);
  if (!crypto.verify(null, Buffer.from(manifesto), require("../desktop/update-key.json").publicKey, assinatura)) throw Error("Assinatura da CI inválida.");
  await fs.writeFile(path.resolve("dist", prefixo + ".json"), manifesto);
  await fs.writeFile(path.resolve("dist", prefixo + ".sig"), assinatura.toString("base64"));
  console.log("Manifesto macOS assinado; DMG e ZIP conferidos: " + perfil + " " + process.arch);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
