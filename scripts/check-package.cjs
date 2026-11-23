"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const pasta = path.resolve(process.argv[2] ?? "dist/win-unpacked/resources/backend");
  const config = JSON.parse(await fs.readFile(path.join(pasta, "config.json"), "utf8"));
  assert.equal(config.perfil, "aluno");
  const nomes = await fs.readdir(pasta);
  for (const nome of [
    "conteudo",
    "professor",
    "gabaritos",
    "autoria.cjs",
    "coruja.cjs",
    "estudio.js",
    ".dados",
  ]) {
    assert.ok(!nomes.includes(nome), "Material privado indevido: " + nome);
  }
  const aulas = await fs.readdir(path.join(pasta, "aulas"));
  assert.deepEqual(aulas, ["aula-12.acai.json"]);
  const aula = JSON.parse(
    await fs.readFile(path.join(pasta, "aulas", aulas[0]), "utf8"),
  );
  assert.equal(aula.professor, undefined);
  assert.equal(aula.exercicios.length, 6);
  console.log("Pacote do aluno: uma aula, seis desafios e nenhum acervo privado.");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
