const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criar } = require("../engine/acervo-atualizacoes.js");
function contexto(opcoes = {}) {
  const estados = [], recebidos = [], aplicados = [];
  let catalogo = { aulas: [{ id: "aula-09", revisao: "nova" }, { id: "aula-10", revisao: "primeira" }] };
  let locais = [{ id: "aula-09", revisaoOnline: "antiga" }], protegidas = [], pode = true;
  const c = criar({
    listar: async () => catalogo,
    locais: () => locais,
    receber: async (ids) => {
      recebidos.push(ids);
      return { fontes: ids.map((id) => ({ nome: id + ".aula-hub", conteudo: JSON.stringify({ id }) })) };
    },
    aplicar: async (fontes) => {
      aplicados.push(fontes);
      locais = locais.map((a) => fontes.some((f) => JSON.parse(f.conteudo).id === a.id) ? { ...a, revisaoOnline: "nova" } : a);
    },
    protegidas: () => protegidas,
    podeAplicar: () => pode,
    aoEstado: (e) => estados.push(e),
    ...opcoes,
  });
  return { c, estados, recebidos, aplicados, proteger(ids) { protegidas = ids; }, liberar(valor) { pode = valor; }, catalogo(valor) { catalogo = valor; } };
}
test("Atualiza somente aulas já recebidas e não repete uma revisão aplicada", async () => {
  const t = contexto(); await t.c.verificar();
  assert.deepEqual(t.recebidos, [["aula-09"]]); assert.equal(t.aplicados.length, 1);
  await t.c.verificar(); assert.equal(t.aplicados.length, 1);
});
test("Aula aberta aguarda aplicação explícita; execução e debugger impedem a troca", async () => {
  const t = contexto(); t.proteger(["aula-09"]); await t.c.verificar();
  assert.equal(t.aplicados.length, 0); assert.deepEqual(t.estados.at(-1).pendentes, ["aula-09"]);
  t.liberar(false); await t.c.aplicarAgora(); assert.equal(t.aplicados.length, 0);
  t.liberar(true); await t.c.aplicarAgora(); assert.equal(t.aplicados.length, 1);
});
test("Retirada da turma após download impede aplicar a revisão pendente", async () => {
  const t = contexto(); t.proteger(["aula-09"]); await t.c.verificar();
  t.catalogo({ aulas: [] }); await t.c.aplicarAgora(); assert.equal(t.aplicados.length, 0);
  assert.deepEqual(t.estados.at(-1).pendentes, []);
});
test("Falha de gravação não anuncia aplicação e uma nova consulta permite tentar novamente", async () => {
  let falhar = true, aplicacoes = 0;
  const t = contexto({ aplicar: async () => { if (falhar) throw Error("disco indisponível"); aplicacoes++; } });
  await t.c.verificar(); assert.match(t.estados.at(-1).erro, /disco/); assert.equal(aplicacoes, 0);
  falhar = false; await t.c.verificar(); assert.equal(aplicacoes, 1);
});
test("Consultas concorrentes não baixam nem aplicam a mesma revisão duas vezes", async () => {
  let responder;
  const t = contexto({ listar: () => new Promise((r) => { responder = r; }) });
  const primeira = t.c.verificar(); await t.c.verificar();
  responder({ aulas: [{ id: "aula-09", revisao: "nova" }] }); await primeira;
  assert.equal(t.recebidos.length, 1); assert.equal(t.aplicados.length, 1);
});
test("Conteúdo fora da seleção e gabaritos são recusados antes da aplicação", async () => {
  for (const aula of [{ id: "aula-10" }, { id: "aula-09", professor: {} }]) {
    const t = contexto({ receber: async () => ({ fontes: [{ conteudo: JSON.stringify(aula) }] }) });
    await t.c.verificar(); assert.equal(t.aplicados.length, 0); assert.ok(t.estados.at(-1).erro);
  }
});

test("Aviso de runtime incompatível termina quando a revisão é retirada", async () => {
  const t = contexto({ receber: async () => ({ fontes: [], indisponiveis: [{ id: "aula-09" }] }) });
  await t.c.verificar();
  assert.equal(t.estados.at(-1).exigeAtualizacao, true);
  t.catalogo({ aulas: [] }); await t.c.verificar();
  assert.equal(t.estados.at(-1).exigeAtualizacao, false);
});
