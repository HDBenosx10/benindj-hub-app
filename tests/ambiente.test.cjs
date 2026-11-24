"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { abrirAmbiente } = require("../engine/ambiente.cjs");
const { criarCliente } = require("../engine/recursos-cliente.cjs");
const { avaliarComAmbiente } = require("../engine/avaliacao-ambiente.cjs");
const {
  validarAmbiente,
  mesclarAmbiente,
} = require("../engine/ambiente-schema.cjs");
const base = (recursos) => ({ versao: 1, permitirCriacao: true, recursos });
const sql = (extra = {}) => ({
  id: "banco",
  tipo: "sqlite",
  modo: "memoria",
  ddl: "CREATE TABLE itens(id INTEGER PRIMARY KEY, nome TEXT, total INTEGER);",
  seed: "INSERT INTO itens VALUES(1, 'Livro', 1);",
  ...extra,
});
async function pasta(t) {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "hub-recursos-teste-"));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  return p;
}
async function abrir(t, def) {
  const p = await pasta(t);
  const a = await abrirAmbiente(p, def);
  t.after(() => a.parar());
  return { a, p, c: criarCliente(a.conexao) };
}
test("SQLite real aceita parâmetros, DML, DDL e bloqueia acesso a arquivos externos", async (t) => {
  const { c } = await abrir(t, base([sql()]));
  const db = c.sqlite("banco");
  assert.equal(
    (await db.consultar("SELECT nome FROM itens WHERE id=?", [1]))[0].nome,
    "Livro",
  );
  await db.executar("UPDATE itens SET total=total+1 WHERE id=?", [1]);
  assert.equal((await db.consultar("SELECT total FROM itens"))[0].total, 2);
  await db.script(
    "CREATE TABLE teste(id INTEGER); INSERT INTO teste VALUES(5);",
  );
  assert.equal((await db.consultar("SELECT * FROM teste"))[0].id, 5);
  await assert.rejects(
    db.script("ATTACH DATABASE ':memory:' AS outro"),
    /authorized|authorization/i,
  );
  await assert.rejects(
    db.script("PRAGMA writable_schema=ON"),
    /authorized|authorization/i,
  );
});
test("Políticas da aula separam modelagem de atualização dos registros", async (t) => {
  const { c } = await abrir(
    t,
    base([sql({ permissoes: { ddl: false, dml: true } })]),
  );
  await assert.rejects(
    c.sqlite("banco").script("CREATE TABLE proibida(id INTEGER)"),
    /authorized|authorization/i,
  );
  await c.sqlite("banco").executar("INSERT INTO itens VALUES(2,'Curso',3)");
  assert.equal(
    (await c.sqlite("banco").consultar("SELECT * FROM itens")).length,
    2,
  );
});
test("Modo aluno começa sem tabelas e permite construir o esquema", async (t) => {
  const { c } = await abrir(t, base([sql({ preparo: "aluno" })]));
  await assert.rejects(
    c.sqlite("banco").consultar("SELECT * FROM itens"),
    /no such table/,
  );
  await c
    .sqlite("banco")
    .script("CREATE TABLE itens(id INTEGER); INSERT INTO itens VALUES(9)");
  assert.equal(
    (await c.sqlite("banco").consultar("SELECT * FROM itens"))[0].id,
    9,
  );
});
test("Banco em arquivo preserva alterações e não reaplica seed ao reiniciar", async (t) => {
  const p = await pasta(t);
  const def = base([sql({ modo: "arquivo" })]);
  let a = await abrirAmbiente(p, def);
  await criarCliente(a.conexao)
    .sqlite("banco")
    .executar("UPDATE itens SET total=8");
  await a.parar();
  a = await abrirAmbiente(p, def);
  try {
    assert.equal(
      (
        await criarCliente(a.conexao)
          .sqlite("banco")
          .consultar("SELECT total FROM itens")
      )[0].total,
      8,
    );
  } finally {
    await a.parar();
  }
});
test("Documentos JSON suportam CRUD, filtros e persistência sem depender de MongoDB", async (t) => {
  const { c } = await abrir(
    t,
    base([
      {
        id: "docs",
        tipo: "documentos",
        modo: "arquivo",
        colecoes: { pessoas: [{ _id: "ana", nome: "Ana", idade: 20 }] },
      },
    ]),
  );
  const docs = c.documentos("docs");
  await docs.inserir("pessoas", { _id: "bia", nome: "Bia", idade: 30 });
  assert.equal(
    (await docs.buscar("pessoas", { idade: { $gte: 25 } }))[0].nome,
    "Bia",
  );
  assert.equal(
    (await docs.atualizar("pessoas", { _id: "ana" }, { idade: 21 })).alterados,
    1,
  );
  assert.equal((await docs.remover("pessoas", { _id: "bia" })).removidos, 1);
  await assert.rejects(docs.inserir("pessoas", { _id: "ana" }), /existente/);
  assert.equal((await docs.buscar("pessoas"))[0].idade, 21);
});
test("Mocks atendem HTTP real, atraso, sequência de erro e sucesso e histórico", async (t) => {
  const { a, c } = await abrir(
    t,
    base([
      {
        id: "externa",
        tipo: "mock-http",
        rotas: [
          {
            metodo: "POST",
            caminho: "/pedidos",
            sequencia: [
              { status: 503, corpo: { erro: "temporário" } },
              { status: 201, atrasoMs: 60, corpo: { id: 42 } },
            ],
          },
        ],
      },
    ]),
  );
  const url = c.url("externa") + "/pedidos";
  assert.equal(
    (await fetch(url, { method: "POST", body: '{"valor":10}' })).status,
    503,
  );
  const inicio = Date.now();
  const r = await fetch(url, { method: "POST", body: '{"valor":20}' });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).id, 42);
  assert.ok(Date.now() - inicio >= 45);
  const estado = await a.operar({ acao: "estado" });
  assert.equal(estado.registros.length, 2);
  assert.equal(estado.registros[1].corpo.valor, 20);
});
test("Casos de verificação usam ambientes novos e não compartilham mutações", async () => {
  const r = await avaliarComAmbiente(
    'async function incrementar(){await recursos.sqlite("banco").executar("UPDATE itens SET total=total+1");return (await recursos.sqlite("banco").consultar("SELECT total FROM itens"))[0].total;}',
    [
      { nome: "primeiro", executar: "return incrementar();", esperado: 2 },
      { nome: "segundo", executar: "return incrementar();", esperado: 2 },
    ],
    base([sql()]),
  );
  assert.ok(
    r.every((t) => t.passou),
    JSON.stringify(r),
  );
});
test("Aberturas concorrentes compartilham uma instância, e memória reinicia ao encerrar", async (t) => {
  const g = require("../engine/ambiente-gerenciador.cjs").criarGerenciador(
    await pasta(t),
  );
  t.after(() => g.encerrar());
  const aula = { ambiente: base([sql()]) };
  const [a, b] = await Promise.all([
    g.obter("aluno:aula-01", aula),
    g.obter("aluno:aula-01", aula),
  ]);
  assert.equal(a.conexao.base, b.conexao.base);
  await a.operar({
    recurso: "banco",
    acao: "sql",
    sql: "UPDATE itens SET total=7",
  });
  await g.parar("aluno:aula-01");
  const novo = await g.obter("aluno:aula-01", aula);
  assert.equal(
    (
      await novo.operar({
        recurso: "banco",
        acao: "sql",
        sql: "SELECT total FROM itens",
      })
    ).linhas[0].total,
    1,
  );
});
test("Manifesto rejeita ids, headers e alterações em recursos fixados", () => {
  assert.throws(
    () => validarAmbiente(base([sql({ permissoes: { ddl: "false" } })])),
    /true ou false/,
  );
  assert.throws(() => validarAmbiente(base([sql({ id: "../escape" })])));
  assert.throws(() =>
    validarAmbiente(
      base([
        {
          id: "api",
          tipo: "mock-http",
          rotas: [{ metodo: "GET", caminho: "/", headers: { X: "a\r\nb" } }],
        },
      ]),
    ),
  );
  assert.throws(
    () => mesclarAmbiente(base([sql()]), base([sql({ ddl: "" })])),
    /fixado/,
  );
});

test("Adicionar um recurso preserva o banco em memória que já está em uso", async (t) => {
  const g = require("../engine/ambiente-gerenciador.cjs").criarGerenciador(
    await pasta(t),
  );
  t.after(() => g.encerrar());
  const aula = { ambiente: base([sql()]) };
  const a = await g.obter("aluno:aula-01", aula);
  await a.operar({
    recurso: "banco",
    acao: "sql",
    sql: "UPDATE itens SET total=23",
  });
  const atualizado = await g.configurar(
    "aluno:aula-01",
    aula,
    base([sql(), { id: "novo", tipo: "documentos", colecoes: {} }]),
  );
  assert.equal(a.conexao.base, atualizado.conexao.base);
  assert.equal(
    (
      await atualizado.operar({
        recurso: "banco",
        acao: "sql",
        sql: "SELECT total FROM itens",
      })
    ).linhas[0].total,
    23,
  );
});
test(
  "Consulta SQL infinita é interrompida em outro processo e permite reabrir o ambiente",
  { timeout: 12000 },
  async (t) => {
    const { a, p } = await abrir(t, base([sql()]));
    await assert.rejects(
      a.operar({
        recurso: "banco",
        acao: "sql",
        sql: "WITH RECURSIVE numeros(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM numeros) SELECT sum(x) FROM numeros",
      }),
      /tempo limite/,
    );
    assert.equal(a.fechado, true);
    const novo = await abrirAmbiente(p, base([sql()]));
    try {
      assert.equal(
        (
          await novo.operar({
            recurso: "banco",
            acao: "sql",
            sql: "SELECT total FROM itens",
          })
        ).linhas[0].total,
        1,
      );
    } finally {
      await novo.parar();
    }
  },
);

test(
  "Um servidor preso em SQL nativo pode ser parado pelo supervisor",
  { timeout: 8000 },
  async (t) => {
    const p = await pasta(t);
    const projeto = await require("../engine/projetos.cjs").abrirProjeto(p, {
      "app.cjs": `const http=require('node:http');const {DatabaseSync}=require('node:sqlite');exports.criarServidor=()=>http.createServer((req,res)=>{new DatabaseSync(':memory:').prepare('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n').get();res.end('fim');});`,
    });
    try {
      await assert.rejects(
        fetch(projeto.base, { signal: AbortSignal.timeout(150) }),
      );
    } finally {
      await projeto.parar();
    }
    await assert.rejects(
      fetch(projeto.base, { signal: AbortSignal.timeout(500) }),
    );
  },
);

test("Inspeção visual expõe colunas e relações sem liberar PRAGMA ao aluno", async (t) => {
  const {a,c} = await abrir(t,base([sql({ddl:'CREATE TABLE pais(id INTEGER PRIMARY KEY); CREATE TABLE filhos(id INTEGER PRIMARY KEY, pai_id INTEGER REFERENCES pais(id));',seed:''})]));
  const estado=await a.operar({acao:'estado'});
  const tabela=estado.recursos[0].tabelas.find(t=>t.name==='filhos');
  assert.ok(tabela.colunas.some(c=>c.name==='pai_id'));
  assert.equal(tabela.relacoes[0].table,'pais');
  await assert.rejects(()=>c.sqlite('banco').consultar('PRAGMA table_info(filhos)'),/authoriz|autoriz/i);
});
