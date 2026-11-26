const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { executarCliente } = require("../engine/projetos.cjs");
test("Painel chama consulta e criação com argumentos e sessão nas posições corretas", async () => {
  const chamadas = [];
  const projeto = {
    base: "http://127.0.0.1:4321",
    async modulo(...args) {
      chamadas.push(args);
      return { ok: true };
    },
  };
  await executarCliente(projeto, { token: "sessao" });
  const produto = { nome: "Ação", precoCentavos: 0, estoque: 0 };
  assert.deepEqual(
    await executarCliente(projeto, {
      funcao: "criarProduto",
      produto,
      token: "sessao",
    }),
    { ok: true },
  );
  assert.deepEqual(chamadas, [
    ["cliente.cjs", "consultarProdutos", [projeto.base, "sessao"]],
    ["cliente.cjs", "criarProduto", [projeto.base, produto, "sessao"]],
  ]);
  await assert.rejects(
    executarCliente(projeto, { funcao: "outra" }),
    /Escolha/,
  );
  for (const produto of [undefined, null, [], 3])
    await assert.rejects(
      executarCliente(projeto, { funcao: "criarProduto", produto }),
      /corpo JSON/,
    );
  assert.equal(chamadas.length, 2);
});
