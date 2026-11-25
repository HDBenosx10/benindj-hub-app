"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const asar = require("@electron/asar"),
  yaml = require("js-yaml");
const perfil = process.env.HUB_PROFILE || "aluno",
  id = require("../desktop/identidade.cjs").identidade(perfil);
const raiz = path.resolve(process.argv[2] || "dist/win-unpacked");
const pacote = JSON.parse(
  asar.extractFile(path.join(raiz, "resources/app.asar"), "package.json"),
);
const config = JSON.parse(
  fs.readFileSync(path.join(raiz, "resources/backend/config.json"), "utf8"),
);
const updater = yaml.load(
  fs.readFileSync(path.join(raiz, "resources/app-update.yml"), "utf8"),
);
assert.equal(pacote.name, id.nomeInterno);
assert.equal(pacote.hubPerfil, perfil);
assert.equal(config.perfil, perfil);
assert.equal(updater.updaterCacheDirName, id.nomeInterno + "-updater");
assert.ok(fs.existsSync(path.join(raiz, id.nome + ".exe")));
console.log(
  "Identidade do pacote conferida: " +
    perfil +
    ", pasta e cache exclusivos; perfil de dados preservado.",
);
