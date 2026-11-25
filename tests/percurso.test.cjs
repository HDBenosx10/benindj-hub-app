const { test } = require("node:test"),
  assert = require("node:assert/strict");
const p = require("../engine/percurso.js"),
  j = require("../engine/jornada.cjs");
const plano = {
  id: "percurso-12345678-1234-4234-8234-123456789abc",
  nome: "Meu percurso de APIs",
  objetivo: "backend",
  linguagem: "javascript",
  etapas: [
    { aulaId: "aula-10", grupo: "Preparação" },
    { aulaId: "aula-02", grupo: "Construção" },
  ],
};
const a = (n) => ({
  id: "aula-" + String(n).padStart(2, "0"),
  numero: n,
  titulo: "Aula " + n,
  progresso: { completa: false, concluidos: 0, total: 2 },
  estudo: { iniciada: false },
});
test("Sem atividade, o início escolhe a primeira aula e não as últimas importadas", () => {
  const r = p.sugerir([a(10), a(8), a(9), a(0)]);
  assert.equal(r.principal.id, "aula-00");
  assert.deepEqual(
    r.cards.map((a) => a.numero),
    [0, 8, 9],
  );
  assert.equal(r.iniciadas, 0);
  assert.equal(r.retomando, false);
});
test("Importar novas aulas não muda o ponto de retomada; aulas concluídas não são pendências", () => {
  const primeira = {
    ...a(0),
    progresso: { completa: true, concluidos: 2, total: 2 },
  };
  const aberta = {
    ...a(2),
    estudo: { iniciada: true, atualizadaEm: "2026-11-25T12:00:00Z" },
  };
  const r = p.sugerir([a(10), primeira, a(8), aberta]);
  assert.equal(r.principal.id, "aula-02");
  assert.equal(r.retomando, true);
  assert.equal(r.concluidas, 1);
  assert.equal(r.iniciadas, 1);
  const completo = p.sugerir([primeira]);
  assert.equal(completo.finalizado, true);
  assert.equal(completo.retomando, false);
});
test("Professor define ordem e grupos; metadados publicados não revelam outras aulas", () => {
  const base = [a(2), a(10)].map((a) => ({
    ...a,
    percursos: p.descrever([plano], a.id),
  }));
  assert.deepEqual(
    p
      .sugerir(base, { trilha: "backend", linguagem: "javascript" })
      .lista.map((a) => a.numero),
    [10, 2],
  );
  const recebido = p.recebidos([base[0]]);
  assert.equal(recebido[0].aulas.length, 1);
  assert.equal(recebido[0].aulas[0].grupoPercurso, "Construção");
  assert.ok(!JSON.stringify(base[0].percursos).includes("aula-10"));
});
test("Preferência e percurso são independentes; aula avulsa não inventa trilha", () => {
  assert.deepEqual(p.recebidos([a(0), a(8)]), []);
  const base = [a(2), a(10)].map((a) => ({
    ...a,
    percursos: p.descrever([plano], a.id),
  }));
  assert.equal(
    p.sugerir(base, { trilha: "frontend", linguagem: "javascript" }).ativo,
    null,
  );
  assert.equal(
    p.sugerir(base, {
      trilha: "frontend",
      linguagem: "javascript",
      percursoId: plano.id,
    }).ativo.id,
    plano.id,
  );
  assert.throws(() =>
    p.validar({ ...plano, etapas: [plano.etapas[0], plano.etapas[0]] }, [
      "aula-10",
    ]),
  );
  assert.throws(() => p.validar(plano, ["aula-02"]));
});
test("Abrir dados não cria início fictício; posição persiste sem conceder aprovação", () => {
  const aula = {
    modo: "funcoes",
    exercicios: [
      { id: "um", titulo: "Primeiro", codigoInicial: "", testes: [{}] },
      { id: "dois", titulo: "Segundo", codigoInicial: "", testes: [{}] },
    ],
  };
  const s = { codigos: { um: "", dois: "" }, progresso: {} };
  assert.equal(j.posicao(aula, s).iniciada, false);
  j.registrarEstudo(
    aula,
    s,
    { aba: "praticar", atividadeId: "dois" },
    "2026-11-25T12:00:00.000Z",
  );
  const restaurado = JSON.parse(JSON.stringify(s)),
    r = j.posicao(aula, restaurado);
  assert.equal(r.atividadeId, "dois");
  assert.equal(r.aba, "praticar");
  assert.equal(r.indiceAtividade, 1);
  assert.equal(r.iniciada, true);
  assert.equal(j.resumo(aula, s).concluidos, 0);
  j.registrarEstudo(
    aula,
    s,
    { aba: "invalida", atividadeId: "apagada" },
    "2026-11-25T13:00:00.000Z",
  );
  assert.equal(j.posicao(aula, s).atividadeId, "dois");
});
test("Código antigo é reconhecido como iniciado, sem fabricar datas passadas", () => {
  const aula = {
    modo: "funcoes",
    exercicios: [{ id: "a", codigoInicial: "inicial", testes: [{}] }],
  };
  const r = j.posicao(aula, { codigos: { a: "minha tentativa" } });
  assert.equal(r.iniciada, true);
  assert.equal(r.iniciadaEm, null);
  assert.equal(r.atualizadaEm, null);
});
test("Planejamento chega antes do conteúdo e não fabrica progresso nem aulas executáveis", () => {
  const planejamento = p.manifesto(plano, [a(10), a(2)]);
  const r = p.sugerir(
    [a(0)],
    { trilha: "backend", linguagem: "javascript", percursoId: plano.id },
    [planejamento],
  );
  assert.equal(r.ativo.id, plano.id);
  assert.equal(r.bloqueadas.length, 2);
  assert.equal(r.disponiveis, 0);
  assert.equal(r.finalizado, false);
  assert.equal(r.aguardando, true);
  assert.deepEqual(
    r.lista.map((a) => a.numero),
    [10, 2],
  );
  assert.ok(!JSON.stringify(planejamento).includes("exercicios"));
  const depois = p.sugerir([a(0), a(10)], { percursoId: plano.id }, [
    planejamento,
  ]);
  assert.equal(depois.principal.id, "aula-10");
  assert.equal(depois.bloqueadas.length, 1);
  assert.equal(depois.iniciadas, 0);
  assert.throws(() =>
    p.validarManifesto({
      ...planejamento,
      exercicios: [{ codigo: "não permitido" }],
    }),
  );
});
