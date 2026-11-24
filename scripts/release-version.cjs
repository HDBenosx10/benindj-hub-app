"use strict";
const fs = require("node:fs");
exports.validarVersao = function validarVersao(valor) {
  const versao = String(valor ?? "")
    .trim()
    .replace(/^v/, "");
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.test(
      versao,
    )
  )
    throw Error("Informe uma versão como 0.6.0 ou 0.7.0-beta.1.");
  if (
    versao
      .split("-")
      .slice(1)
      .join("-")
      .split(".")
      .some((id) => /^0\d+$/.test(id))
  )
    throw Error(
      "Identificador numérico de pré-release não pode começar por zero.",
    );
  return versao;
};
if (require.main === module) {
  const versao = exports.validarVersao(
    process.env.HUB_RELEASE_VERSION ?? process.argv[2],
  );
  if (fs.existsSync(".git") && process.env.GITHUB_ACTIONS) {
    const { execFileSync } = require("node:child_process");
    const refs = execFileSync("git", ["tag", "--list", "v" + versao], {
      encoding: "utf8",
    }).trim();
    if (refs && process.env.GITHUB_REF !== "refs/tags/v" + versao)
      throw Error(
        "A versão v" + versao + " já existe. Escolha uma versão nova.",
      );
  }
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${versao}\ntag=v${versao}\n`,
    );
  console.log("Versão validada: " + versao);
}
