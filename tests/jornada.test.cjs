"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarEscolha,
  resumo,
  registrar,
  trilhaDaAula,
} = require("../engine/jornada.cjs");
const aula = {
  numero: 1,
  modo: "funcoes",
  exercicios: [
    { id: "a", testes: [{}] },
    { id: "b", testes: [{}, {}] },
  ],
};
test("Escolha distingue preferência de trilha e runtime disponível", () => {
  assert.equal(
    validarEscolha({ trilha: "ia", linguagem: "javascript" }).trilha,
    "ia",
  );
  assert.throws(
    () => validarEscolha({ trilha: "backend", linguagem: "java" }),
    /V2/,
  );
  assert.throws(() =>
    validarEscolha({ trilha: "inexistente", linguagem: "javascript" }),
  );
  assert.equal(trilhaDaAula({ numero: 12 }), "comum");
  assert.equal(trilhaDaAula({ numero: 40 }), "backend");
});
test("Verificações parciais acumulam, persistem e exigem todos os cenários", () => {
  const salvo = { codigos: { a: "a", b: "b" } };
  assert.equal(
    registrar(aula, salvo, [{ exercicioId: "a", passou: true }], "a")
      .concluidos,
    1,
  );
  assert.equal(
    registrar(aula, salvo, [{ exercicioId: "b", passou: true }], "b")
      .concluidos,
    1,
  );
  assert.equal(
    registrar(
      aula,
      salvo,
      [
        { exercicioId: "b", passou: true },
        { exercicioId: "b", passou: true },
      ],
      "b",
    ).completa,
    true,
  );
  assert.equal(resumo(aula, JSON.parse(JSON.stringify(salvo))).completa, true);
  salvo.codigos.a = "alterado";
  assert.equal(resumo(aula, salvo).concluidos, 1);
});
test("Alterar critérios ou ambiente exige nova validação", () => {
  const salvo = { codigos: { a: "a", b: "b" } };
  registrar(aula, salvo, [{ exercicioId: "a", passou: true }], "a");
  assert.equal(
    resumo({ ...aula, ambiente: { recursos: [] } }, salvo).concluidos,
    0,
  );
});
test("Projeto não recebe conclusão com lista de resultados vazia", () => {
  const a = { modo: "projeto", projeto: { testes: [{}] } };
  const s = { arquivos: { "app.cjs": "codigo" } };
  assert.equal(registrar(a, s, []).completa, false);
  assert.equal(registrar(a, s, [{ passou: true }]).completa, true);
  s.arquivos["app.cjs"] = "novo";
  assert.equal(resumo(a, s).completa, false);
});
