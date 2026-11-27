const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criar } = require("../engine/notificacoes.js");

function contexto() {
  const exibidas = [],
    timers = new Map();
  let visivel = false,
    sequencia = 0;
  const aviso = criar({
    mostrar: (dado) => {
      exibidas.push(dado.chave);
      visivel = true;
    },
    ocultar: () => {
      visivel = false;
    },
    agendar: (acao) => {
      timers.set(++sequencia, acao);
      return sequencia;
    },
    cancelar: (id) => timers.delete(id),
  });
  return { aviso, exibidas, timers, visivel: () => visivel };
}

test("Fechar aviso não descarta a atualização e consultas repetidas não o reabrem", () => {
  const t = contexto();
  const pendente = { chave: "pendente:aula-02:r2" };
  t.aviso.exibir(pendente);
  assert.ok(t.visivel());
  t.aviso.fechar();
  assert.equal(t.visivel(), false);
  t.aviso.exibir(pendente);
  assert.equal(t.visivel(), false);
  t.aviso.exibir(null);
  t.aviso.exibir(pendente);
  assert.equal(t.visivel(), false);
  t.aviso.exibir({ chave: "pendente:aula-02:r3" });
  assert.ok(t.visivel());
});

test("Confirmação desaparece sozinha e uma consulta não reinicia a contagem", () => {
  const t = contexto(),
    sucesso = { chave: "aplicada:r2", duracao: 10000 };
  t.aviso.exibir(sucesso);
  const [id, expirar] = [...t.timers][0];
  t.aviso.exibir(sucesso);
  assert.deepEqual([...t.timers.keys()], [id]);
  expirar();
  assert.equal(t.visivel(), false);
  t.aviso.exibir(sucesso);
  assert.equal(t.visivel(), false);
});

test("Aviso novo cancela o fechamento do anterior; erro pode ser fechado manualmente", () => {
  const t = contexto();
  t.aviso.exibir({ chave: "aplicada:r2", duracao: 10000 });
  t.aviso.exibir({ chave: "erro:rede" });
  assert.equal(t.timers.size, 0);
  assert.ok(t.visivel());
  t.aviso.fechar();
  assert.equal(t.visivel(), false);
});
