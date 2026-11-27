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

test("Revisão de projeto preserva aprovação de texto, mas exige verificar mudanças executáveis", () => {
  const original = {
    modo: "projeto",
    projeto: {
      tipo: "http",
      arquivos: [{ nome: "app.cjs", editavel: true, codigo: "// inicial" }, { nome: "apoio.cjs", editavel: false, codigo: "exports.x = 1;" }],
      testes: [{ nome: "Nome anterior", acoes: [{ metodo: "GET", caminho: "/", status: 200 }] }],
      requisicoes: [{ nome: "Explorar" }],
    },
  };
  const salvo = { arquivos: { "app.cjs": "// minha solução", "apoio.cjs": "exports.x = 1;" } };
  registrar(original, salvo, [{ passou: true }]);
  const nova = structuredClone(original);
  nova.projeto.testes[0].nome = "Nome mais claro";
  nova.projeto.requisicoes[0].nome = "Exemplo explicado";
  nova.projeto.arquivos[0].codigo = "// novo ponto de partida";
  assert.ok(preservarAprovacoes(original, nova, salvo));
  assert.ok(resumo(nova, salvo).completa);
  assert.equal(salvo.arquivos["app.cjs"], "// minha solução");
  for (const alterar of [
    (a) => { a.projeto.testes[0].acoes[0].status = 201; },
    (a) => { a.projeto.arquivos[1].codigo = "exports.x = 2;"; },
    (a) => { a.ambiente = { recursos: [] }; },
  ]) {
    const alterada = structuredClone(nova), tentativa = structuredClone(salvo);
    alterar(alterada);
    assert.equal(preservarAprovacoes(nova, alterada, tentativa), false);
    assert.equal(resumo(alterada, tentativa).revalidar, 1);
  }
  const editado = structuredClone(salvo);
  editado.arquivos["app.cjs"] = "// outra tentativa";
  const textual = structuredClone(nova); textual.projeto.testes[0].nome = "Outro título";
  assert.equal(preservarAprovacoes(nova, textual, editado), false);
});

test("Reordenação e inclusão de exercício preservam aprovados por ID; novo critério pede verificação", () => {
  const original = structuredClone(aula), salvo = { codigos: { a: "minha solução", b: "outra" } };
  registrar(original, salvo, [{ exercicioId: "a", passou: true }], "a");
  const nova = structuredClone(original);
  nova.exercicios.reverse();
  nova.exercicios.push({ id: "c", testes: [{}] });
  assert.equal(resumo(nova, salvo).concluidos, 1);
  nova.exercicios.find((e) => e.id === "a").testes.push({ executar: "return 3;", esperado: 3 });
  assert.equal(preservarAprovacoes(original, nova, salvo), false);
  assert.equal(resumo(nova, salvo).revalidar, 1);
  assert.equal(salvo.codigos.a, "minha solução");
});
