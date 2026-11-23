"use strict";
const fs = require("node:fs");
const path = require("node:path");
const arquivo = path.resolve(process.argv[2] ?? "package.json");
const versao = JSON.parse(fs.readFileSync(arquivo, "utf8")).version;
const tag = process.env.GITHUB_REF_NAME;
if (process.env.GITHUB_REF_TYPE === "tag" && tag !== "v" + versao) {
  throw Error(`A tag ${tag} não corresponde à versão ${versao} de ${arquivo}.`);
}
console.log("Versão conferida: " + versao);
