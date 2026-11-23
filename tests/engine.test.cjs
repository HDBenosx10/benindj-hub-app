"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { executar } = require("../engine/executar.cjs");
test("o aluno recebe seis desafios e nenhum campo privado", async () => {
  const aula = JSON.parse(
    await fs.readFile(path.join(__dirname, "../aulas/aula-12.aula-acai"), "utf8"),
  );
  assert.equal(aula.exercicios.length, 6);
  assert.equal(aula.professor, undefined);
  assert.ok(!JSON.stringify(aula).includes("gabaritos"));
});
test("run suporta console, await e erro sem aprovação fictícia", async () => {
  let r = await executar('console.log("hipótese",await Promise.resolve(21));');
  assert.equal(r.erro, null);
  assert.deepEqual(r.saida, ["hipótese 21"]);
  assert.equal(r.passou, undefined);
  r = await executar('throw Error("investigar");');
  assert.match(r.erro, /investigar/);
});
test("laço infinito pode ser interrompido e não impede a próxima execução", async () => {
  const r = await executar("while(true){}", 100);
  assert.match(r.erro, /interrompida/);
  assert.equal((await executar("console.log(8)")).saida[0], "8");
});
