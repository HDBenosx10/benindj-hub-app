"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
async function gerar() {
  const pasta = path.resolve(process.argv[2] ?? "dist");
  const commit = (pastaGit) =>
    execFileSync("git", ["-C", pastaGit, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  const info = {
    produto: "BeninDJ Hub",
    versao: require("./release-version.cjs").validarVersao(
      process.env.HUB_RELEASE_VERSION ??
        require(path.resolve("package.json")).version,
    ),
    perfil: process.env.HUB_PROFILE ?? "aluno",
    repositorio: process.env.GITHUB_REPOSITORY ?? null,
    commit: process.env.GITHUB_SHA ?? commit(process.cwd()),
    motorCommit: commit(path.resolve(__dirname, "..")),
    geradoEm: new Date().toISOString(),
    plataforma: "Windows x64",
  };
  await fs.mkdir(pasta, { recursive: true });
  await fs.writeFile(
    path.join(pasta, "BUILD-INFO.json"),
    JSON.stringify(info, null, 2) + "\n",
    "utf8",
  );
}
if (require.main === module)
  gerar().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
