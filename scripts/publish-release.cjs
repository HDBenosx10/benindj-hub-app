"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { validarVersao } = require("./release-version.cjs");
const versao = validarVersao(process.env.HUB_RELEASE_VERSION);
const perfil = process.env.HUB_PROFILE === "professor" ? "Professor" : "Aluno";
const repo = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
if (!repo || !sha)
  throw Error("Este comando deve ser executado pelo workflow de release.");
const pasta = path.resolve("dist");
const nome = `BeninDJ-Hub-${perfil}-${versao}-Windows-x64.exe`;
const arquivos = [
  nome,
  `BeninDJ-Hub-${perfil}-${versao}-Instalador-Windows-x64.exe`,
  "SHA256SUMS.txt",
  "BUILD-INFO.json",
  `update-manifest-${perfil.toLowerCase()}.json`,
  `update-manifest-${perfil.toLowerCase()}.sig`,
  `${require("semver").prerelease(versao)?.[0] ?? "latest"}.yml`,
  `BeninDJ-Hub-${perfil}-${versao}-Instalador-Windows-x64.exe.blockmap`,
].map((n) => path.join(pasta, n));
if (perfil === "Professor") {
  for (const n of fs
    .readdirSync(path.resolve("trilhas"))
    .filter((n) => n.endsWith(".trilha-hub")))
    arquivos.push(path.resolve("trilhas", n));
}
for (const p of arquivos)
  if (!fs.existsSync(p)) throw Error("Artefato ausente: " + path.basename(p));
const args = [
  "release",
  "create",
  "v" + versao,
  ...arquivos,
  "--repo",
  repo,
  "--target",
  sha,
  "--title",
  `BeninDJ Hub ${perfil} v${versao}`,
  "--notes-file",
  path.resolve(__dirname, "../RELEASE-NOTES.md"),
];
if (process.env.HUB_PUBLISH !== "true") args.push("--draft");
if (process.env.HUB_PRERELEASE === "true" || versao.includes("-"))
  args.push("--prerelease");
execFileSync("gh", args, { stdio: "inherit", windowsHide: true });
