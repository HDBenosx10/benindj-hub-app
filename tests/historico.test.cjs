const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { registrar } = require("../engine/historico.cjs");
test("Tentativas conservam a última aprovação e não misturam código de questões diferentes", () => {
  let lista = registrar(
    [],
    { codigos: { a: "solução", b: "outra" } },
    "Verificação",
    "a",
    true,
  );
  assert.deepEqual(lista[0].conteudo.codigos, { a: "solução" });
  assert.equal(
    registrar(
      lista,
      { codigos: { a: "solução", b: "nova" } },
      "Verificação",
      "a",
      true,
    ),
    lista,
  );
  const original = lista[0].id;
  for (let i = 0; i < 20; i++)
    lista = registrar(
      lista,
      { codigos: { a: "tentativa " + i } },
      "Verificação",
      "a",
      false,
    );
  assert.ok(lista.some((h) => h.id === original));
  assert.ok(lista.length <= 32);
  const c = lista[0].conteudo.codigos.a;
  const respostas = { codigos: { a: "texto atual" } };
  assert.equal(lista[0].conteudo.codigos.a, c);
  assert.equal(respostas.codigos.a, "texto atual");
});
test("Snapshot de projeto inclui arquivos por valor, sem referências mutáveis", () => {
  const dados = { codigos: {}, arquivos: { "app.cjs": "inicial" } };
  const lista = registrar([], dados, "Antes de restaurar");
  dados.arquivos["app.cjs"] = "novo";
  assert.equal(lista[0].conteudo.arquivos["app.cjs"], "inicial");
});
