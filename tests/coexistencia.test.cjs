"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { identidade } = require("../desktop/identidade.cjs");
const {
  getWindowsInstallationDirName,
} = require("app-builder-lib/out/targets/targetUtil");
test("Instaladores one-click usam pastas e caches distintos para Professor e Aluno", () => {
  const edicoes = ["aluno", "professor"].map((perfil) => {
    const id = identidade(perfil);
    return {
      ...id,
      pasta: getWindowsInstallationDirName(
        { productFilename: id.nome, sanitizedName: id.nomeInterno },
        false,
      ),
      cache: id.nomeInterno + "-updater",
    };
  });
  for (const campo of ["appId", "nomeInterno", "nome", "pasta", "cache"])
    assert.notEqual(edicoes[0][campo], edicoes[1][campo], campo);
  assert.equal(edicoes[0].nome, "BeninDJ Hub Aluno");
  assert.equal(edicoes[1].nome, "BeninDJ Hub Professor");
  assert.ok(edicoes.every((e) => e.pasta !== "benindj-hub-app"));
});
