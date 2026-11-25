"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarEscolha,
  resumo,
  registrar,
  trilhaDaAula,
  preservarAprovacoes,
} = require("../engine/jornada.cjs");
test("Revisão de texto preserva aprovação antiga, mas novo critério e código editado não ganham aprovação", () => {
  const original = {
    modo: "funcoes",
    exercicios: [
      {
        id: "a",
        titulo: "Antigo",
        enunciado: "Texto anterior",
        testes: [{ nome: "Antes", executar: "return 1;", esperado: 1 }],
      },
      { id: "b", testes: [{ executar: "return 2;", esperado: 2 }] },
    ],
  };
  const salvo = { codigos: { a: "solucao a", b: "solucao b" } };
  registrar(original, salvo, [
    { exercicioId: "a", passou: true },
    { exercicioId: "b", passou: true },
  ]);
  const nova = structuredClone(original);
  nova.exercicios[0].titulo = "Novo contexto";
  nova.exercicios[0].enunciado = "Explicação revisada";
  nova.exercicios[0].qualidade = { alvo: "mesma regra" };
  nova.exercicios[0].testes[0].nome = "Nome mais claro";
  nova.exercicios[1].testes[0].esperado = 3;
  assert.equal(preservarAprovacoes(original, nova, salvo), true);
  assert.equal(resumo(nova, salvo).concluidos, 1);
  const alterado = { codigos: { a: "solucao a" } };
  registrar(original, alterado, [{ exercicioId: "a", passou: true }], "a");
  alterado.codigos.a = "outra tentativa";
  assert.equal(preservarAprovacoes(original, nova, alterado), false);
  assert.equal(resumo(nova, alterado).concluidos, 0);
});
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
