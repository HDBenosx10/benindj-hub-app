"use strict";
const { execFileSync } = require("node:child_process");
const repo = process.env.GITHUB_REPOSITORY;
const versao = require("./release-version.cjs").validarVersao(
  process.env.HUB_RELEASE_VERSION,
);
if (!repo || process.env.HUB_PUBLISH !== "true")
  throw Error("Limpeza permitida apenas após publicação oficial.");
const api = (...args) =>
  execFileSync("gh", ["api", ...args], { encoding: "utf8", windowsHide: true });
const atual = JSON.parse(api(`repos/${repo}/releases/tags/v${versao}`));
if (atual.draft) throw Error("A release atual ainda é um rascunho.");
const paginas = JSON.parse(
  api(`repos/${repo}/releases?per_page=100`, "--paginate", "--slurp"),
);
for (const release of paginas.flat()) {
  if (release.draft && release.id !== atual.id) {
    api("--method", "DELETE", `repos/${repo}/releases/${release.id}`);
    console.log("Rascunho antigo removido: " + release.tag_name);
  }
}
