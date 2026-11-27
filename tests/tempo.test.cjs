const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criar } = require("../engine/tempo-ativo.js");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");

test("Tempo ativo distingue leitura/prática, pausa manual, segundo plano e inatividade sem contar suspensão", () => {
  let agora = 0;
  const eventos = [],
    relogio = criar({
      agora: () => agora,
      registrar: (e) => eventos.push(e),
      limiteInativo: 300000,
    });
  const contexto = { aulaId: "aula-02", atividadeId: null, modo: "leitura" };
  relogio.contexto(contexto);
  agora = 30000;
  relogio.contexto({ ...contexto, atividadeId: "a", modo: "pratica" });
  agora = 50000;
  relogio.janela({ visivel: false, foco: false });
  agora = 150000;
  relogio.janela({ visivel: true, foco: true });
  relogio.interagir();
  agora = 160000;
  relogio.pausar(true);
  agora = 200000;
  relogio.pausar(false);
  agora = 220000;
  relogio.atualizar();
  agora = 10000000;
  relogio.atualizar();
  assert.equal(relogio.motivo(), "inatividade");
  assert.equal(
    eventos
      .filter((e) => e.modo === "leitura")
      .reduce((s, e) => s + e.milisegundos, 0),
    30000,
  );
  assert.equal(
    eventos
      .filter((e) => e.modo === "pratica")
      .reduce((s, e) => s + e.milisegundos, 0),
    50000,
  );
  relogio.interagir();
  agora += 1000;
  relogio.atualizar();
  assert.equal(eventos.at(-1).milisegundos, 1000);
});

test("Leitura contínua pausa ao atingir o limite sem interação", () => {
  let agora = 0;
  const eventos = [], r = criar({ agora: () => agora, registrar: e => eventos.push(e), limiteInativo: 300000 });
  r.contexto({ modo: "leitura" });
  for (agora = 20000; agora <= 400000; agora += 20000) r.atualizar();
  assert.equal(eventos.reduce((s,e)=>s+e.milisegundos,0),300000);
  assert.equal(r.motivo(),"inatividade");
});

test("Não conta tempo fora da aula nem duplica intervalos em consultas repetidas", () => {
  let t = 0;
  const eventos = [];
  const r = criar({ agora: () => t, registrar: (e) => eventos.push(e) });
  t = 20000;
  r.atualizar();
  assert.equal(eventos.length, 0);
  r.contexto({ modo: "leitura" });
  t = 25000;
  r.atualizar();
  r.atualizar();
  r.contexto(null);
  t = 60000;
  r.atualizar();
  assert.equal(
    eventos.reduce((s, e) => s + e.milisegundos, 0),
    5000,
  );
});

test("Registro de horas persiste, é idempotente e separa perfis sem alterar progresso", async () => {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-tempo-"));
  let db;
  try {
    const criarDB = require("../engine/tempo-registro.cjs").criar;
    db = criarDB(path.join(pasta, "tempo.sqlite"));
    const e = {
      id: randomUUID(),
      aulaId: "aula-02",
      atividadeId: "a",
      modo: "pratica",
      dia: "2026-11-27",
      milisegundos: 15000,
    };
    db.registrar("aluno", [e], () => {});
    db.registrar("aluno", [e], () => {});
    assert.equal(db.resumo("aluno")[0].milisegundos, 15000);
    assert.equal(db.resumo("professor").length, 0);
    assert.throws(() =>
      db.registrar(
        "aluno",
        [{ ...e, id: randomUUID(), milisegundos: Infinity }],
        () => {},
      ),
    );
    assert.throws(() =>
      db.registrar("aluno", [{ ...e, id: randomUUID() }], () => {
        throw Error("Aula não recebida");
      }),
    );
    db.fechar();
    db = criarDB(path.join(pasta, "tempo.sqlite"));
    assert.equal(db.resumo("aluno")[0].milisegundos, 15000);
  } finally {
    db?.fechar();
    assert.ok(pasta.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(pasta, { recursive: true, force: true });
  }
});
