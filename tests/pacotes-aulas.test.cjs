"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  montarPacote,
  criarImportador,
} = require("../engine/pacotes-aulas.cjs");
const aula = (n, titulo = "Aula " + n) => ({
  id: "aula-" + String(n).padStart(2, "0"),
  numero: n,
  titulo,
});
const fonte = (a, nome = "aula.aula-hub") => ({
  nome,
  conteudo: "\uFEFF" + JSON.stringify(a),
});
async function contexto(t, existentes = []) {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-lotes-"));
  t.after(() => fs.rm(pasta, { recursive: true, force: true }));
  const aulas = new Map(existentes.map((a) => [a.id, a]));
  const paradas = [];
  const importador = criarImportador({
    aulas,
    pasta,
    validarAula(a) {
      if (
        !a ||
        !/^aula-\d{2}$/.test(a.id) ||
        typeof a.titulo !== "string" ||
        a.professor
      )
        throw Error("Aula inválida");
    },
    antesDeAtualizar: async (id) => paradas.push(id),
  });
  return { ...importador, aulas, pasta, paradas };
}
test("exporta apenas seleção, ordenada e sem gabaritos", () => {
  const catalogo = new Map(
    [0, 1, 2].map((n) => {
      const a = { ...aula(n), professor: { gabarito: "segredo" } };
      return [a.id, a];
    }),
  );
  const publico = ({ professor, ...a }) => a;
  const pacote = montarPacote(catalogo, ["aula-02", "aula-00"], publico);
  assert.deepEqual(
    pacote.aulas.map((a) => a.id),
    ["aula-00", "aula-02"],
  );
  assert.ok(!JSON.stringify(pacote).includes("segredo"));
  assert.throws(() => montarPacote(catalogo, [], publico));
  assert.throws(() => montarPacote(catalogo, ["aula-01", "aula-01"], publico));
  assert.throws(() => montarPacote(catalogo, ["aula-99"], publico));
});
test("Falha ao persistir a migração mantém o conteúdo anterior e permite repetir a atualização", async (t) => {
  const original = aula(1),
    c = await contexto(t, [original]);
  await fs.writeFile(
    path.join(c.pasta, "aula-01.hub.json"),
    JSON.stringify(original),
  );
  let falhar = true;
  const imp = criarImportador({
    aulas: c.aulas,
    pasta: c.pasta,
    validarAula() {},
    depoisDeAtualizar: async () => {
      if (falhar) throw Error("Gravação de progresso recusada");
    },
  });
  const primeiro = imp.preparar([fonte(aula(1, "Texto revisado"))]);
  assert.equal((await imp.confirmar(primeiro.planoId, [0])).resumo.falhas, 1);
  assert.deepEqual(c.aulas.get(original.id), original);
  assert.deepEqual(
    JSON.parse(
      (
        await fs.readFile(path.join(c.pasta, "aula-01.hub.json"), "utf8")
      ).replace(/^\uFEFF/, ""),
    ),
    original,
  );
  falhar = false;
  const segundo = imp.preparar([fonte(aula(1, "Texto revisado"))]);
  assert.equal(
    (await imp.confirmar(segundo.planoId, [0])).resumo.atualizadas,
    1,
  );
});
test("lote misto importa válidas, informa falhas e é idempotente", async (t) => {
  const c = await contexto(t);
  const plano = c.preparar([
    fonte({ tipo: "pacote-aulas-hub", versao: 1, aulas: [aula(1), aula(2)] }),
    { nome: "quebrado.json", conteudo: "{" },
    fonte({ tipo: "resposta" }),
  ]);
  assert.deepEqual(
    plano.linhas.map((l) => l.situacao),
    ["nova", "nova", "invalida", "invalida"],
  );
  assert.ok(plano.linhas.every((l) => !("aula" in l)));
  const r = await c.confirmar(plano.planoId, [0, 1]);
  assert.deepEqual(r.resumo, {
    importadas: 2,
    atualizadas: 0,
    ignoradas: 0,
    falhas: 2,
  });
  assert.deepEqual(await c.confirmar(plano.planoId, [1, 0]), r);
  assert.deepEqual(c.paradas, []); // Recursos são preparados ao abrir, não ao importar.
  assert.equal(
    JSON.parse(
      (
        await fs.readFile(path.join(c.pasta, "aula-01.hub.json"), "utf8")
      ).replace(/^\uFEFF/, ""),
    ).id,
    "aula-01",
  );
});
test("atualização é explícita, guarda versão e preserva respostas e banco", async (t) => {
  const original = aula(1);
  const c = await contexto(t, [original]);
  await fs.writeFile(path.join(c.pasta, "respostas.json"), "rascunho");
  await fs.writeFile(path.join(c.pasta, "hub.sqlite"), "banco");
  const p = c.preparar([fonte(aula(1, "Nova redação")), fonte(aula(2))]);
  assert.equal(p.linhas[0].situacao, "existente");
  const r = await c.confirmar(p.planoId, [1]);
  assert.equal(r.resumo.ignoradas, 1);
  assert.deepEqual(c.aulas.get(original.id), original);
  const p2 = c.preparar([fonte(aula(1, "Nova redação"))]);
  assert.equal((await c.confirmar(p2.planoId, [0])).resumo.atualizadas, 1);
  const backup = JSON.parse(
    (
      await fs.readFile(
        path.join(c.pasta, ".historico", p2.planoId, "aula-01.hub.json"),
        "utf8",
      )
    ).replace(/^\uFEFF/, ""),
  );
  assert.deepEqual(backup, original);
  assert.equal(
    await fs.readFile(path.join(c.pasta, "respostas.json"), "utf8"),
    "rascunho",
  );
  assert.equal(
    await fs.readFile(path.join(c.pasta, "hub.sqlite"), "utf8"),
    "banco",
  );
  assert.deepEqual(c.paradas, ["aula-01"]);
});
test("duplicatas, aulas iguais e alterações posteriores não sobrescrevem silenciosamente", async (t) => {
  const c = await contexto(t, [aula(1)]);
  const d = c.preparar([fonte(aula(2)), fonte(aula(2))]);
  assert.deepEqual(
    d.linhas.map((l) => l.situacao),
    ["duplicada", "duplicada"],
  );
  await assert.rejects(c.confirmar(d.planoId, [0]));
  const p = c.preparar([fonte(aula(1)), fonte(aula(2))]);
  assert.equal(p.linhas[0].situacao, "igual");
  c.aulas.set("aula-02", aula(2, "Outra importação"));
  assert.equal((await c.confirmar(p.planoId, [1])).resumo.falhas, 1);
  assert.equal(c.aulas.get("aula-02").titulo, "Outra importação");
});
test("limites e arquivos privados são recusados", async (t) => {
  const c = await contexto(t);
  assert.throws(() => c.preparar([]));
  assert.throws(() =>
    c.preparar(Array.from({ length: 101 }, () => fonte(aula(1)))),
  );
  const p = c.preparar([
    fonte({ ...aula(1), professor: { gabarito: "não distribuir" } }),
    fonte({ ...aula(2), texto: "x".repeat(4000001) }),
  ]);
  assert.deepEqual(
    p.linhas.map((l) => l.situacao),
    ["invalida", "invalida"],
  );
});
