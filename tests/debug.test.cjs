const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criarSessao, validarConfiguracao } = require("../engine/depurador.cjs");
async function aguardar(sessao, condicao, prazo = 6000) {
  const limite = Date.now() + prazo;
  while (Date.now() < limite) {
    const estado = sessao.estado();
    if (condicao(estado) && !estado.inspecionando) return estado;
    if (estado.status === "erro") throw Error(estado.erro);
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error("Estado não atingido: " + JSON.stringify(sessao.estado()));
}
test("Debugger real pausa, observa variáveis, avança e respeita breakpoints em laços", async (t) => {
  const sessao = await criarSessao({
    arquivo: "atividade.js",
    codigo:
      "let total = 0;\nfor (let i = 0; i < 3; i++) {\n  total += i;\n}\nconsole.log(total);",
    breakpoints: { "atividade.js": [3] },
    observacoes: ["total", "i", "total = 999"],
  });
  t.after(() => sessao.parar());
  let estado = await aguardar(sessao, (e) => e.status === "pausado");
  assert.equal(estado.linha, 1);
  await sessao.controlar("proxima");
  estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.linha === 2,
  );
  assert.equal(estado.variaveis.find((v) => v.nome === "total").valor, "0");
  await sessao.controlar("continuar");
  estado = await aguardar(
    sessao,
    (e) =>
      e.status === "pausado" && e.linha === 3 && e.observacoes.length === 3,
  );
  assert.equal(estado.observacoes[1].valor, "0");
  assert.equal(estado.observacoes[2].erro, true);
  await sessao.controlar("continuar");
  estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.observacoes[1]?.valor === "1",
  );
  assert.equal(estado.observacoes[0].valor, "0");
  await sessao.configurar({}, ["total"]);
  await sessao.controlar("continuar");
  estado = await aguardar(sessao, (e) => e.status === "concluido");
  assert.deepEqual(estado.saida, ["3"]);
});
test("Configuração rejeita caminhos e expressões excessivas", () => {
  assert.throws(() => validarConfiguracao({ "../fora.js": [1] }));
  assert.throws(() => validarConfiguracao({ "a.js": [0] }));
  assert.throws(() => validarConfiguracao({}, ["a".repeat(501)]));
});
test("Entrar e sair de função acompanha parâmetros, await e escopos reais", async (t) => {
  const sessao = await criarSessao({
    arquivo: "funcoes.js",
    codigo:
      "async function dobro(n) {\n  const valor = await Promise.resolve(n * 2);\n  return valor;\n}\nconst resultado = await dobro(7);\nconsole.log(resultado);",
    breakpoints: {},
    observacoes: ["n", "valor"],
  });
  t.after(() => sessao.parar());
  await aguardar(sessao, (e) => e.status === "pausado" && e.linha === 5);
  await sessao.controlar("entrar");
  let estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.linha === 2,
  );
  assert.equal(estado.observacoes[0].valor, "7");
  assert.ok(estado.pilha.length >= 2);
  await sessao.controlar("proxima");
  estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.linha === 3,
  );
  assert.equal(estado.observacoes[1].valor, "14");
  await sessao.controlar("sair");
  estado = await aguardar(sessao, (e) => e.status === "pausado");
  await sessao.controlar("continuar");
  estado = await aguardar(sessao, (e) => e.status === "concluido");
  assert.deepEqual(estado.saida, ["14"]);
});
test("Pausar e parar continuam funcionando durante um laço infinito", async (t) => {
  const sessao = await criarSessao({
    codigo: "let total = 0;\nwhile (true) { total++; }",
    breakpoints: {},
    observacoes: ["total"],
  });
  t.after(() => sessao.parar());
  await aguardar(sessao, (e) => e.status === "pausado");
  await sessao.controlar("continuar");
  await new Promise((r) => setTimeout(r, 50));
  await sessao.controlar("pausar");
  const estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.linha === 2,
  );
  assert.ok(Number(estado.observacoes[0].valor) > 0);
  await sessao.parar();
  assert.equal(sessao.estado().status, "parado");
});
test("Projeto CommonJS mantém a linha dos arquivos e conclui sem deixar processo ativo", async (t) => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path");
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-debug-teste-"));
  await fs.writeFile(
    path.join(pasta, "main.cjs"),
    "const { dobro } = require('./calculo.cjs');\nconsole.log(dobro(4));",
  );
  await fs.writeFile(
    path.join(pasta, "calculo.cjs"),
    "exports.dobro = function dobro(n) {\n  return n * 2;\n};",
  );
  const alias = pasta + "-atalho";
  await fs.symlink(
    pasta,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  const sessao = await criarSessao({
    pasta: alias,
    arquivo: "main.cjs",
    arquivos: ["main.cjs", "calculo.cjs"],
    breakpoints: { "calculo.cjs": [2] },
    observacoes: ["n"],
  });
  t.after(async () => {
    await sessao.parar();
    await fs.unlink(alias);
    await fs.rm(pasta, { recursive: true, force: true });
  });
  await aguardar(sessao, (e) => e.status === "pausado" && e.linha === 1);
  await sessao.controlar("continuar");
  const estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.arquivo === "calculo.cjs",
  );
  assert.equal(estado.linha, 2);
  assert.equal(estado.observacoes[0].valor, "4");
  await sessao.controlar("continuar");
  const fim = await aguardar(sessao, (e) => e.status === "concluido");
  assert.deepEqual(fim.saida, ["8"]);
});
test("Servidor HTTP pausa dentro da rota e conclui a requisição após continuar", async (t) => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path");
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-debug-teste-"));
  await fs.writeFile(
    path.join(pasta, "app.cjs"),
    "const http = require('node:http');\nexports.criarServidor = async function criarServidor() {\n return http.createServer((req, res) => {\n  const mensagem = 'Olá';\n  res.end(mensagem);\n });\n};",
  );
  const sessao = await criarSessao({
    pasta,
    arquivo: "app.cjs",
    arquivos: ["app.cjs"],
    http: true,
    breakpoints: { "app.cjs": [5] },
    observacoes: ["mensagem", "req.url"],
  });
  t.after(async () => {
    await sessao.parar();
    await fs.rm(pasta, { recursive: true, force: true });
  });
  await aguardar(sessao, (e) => e.status === "pausado");
  await sessao.controlar("continuar");
  await aguardar(sessao, (e) => Boolean(e.base));
  await assert.rejects(() =>
    sessao.requisitar({ metodo: "GET", caminho: "//example.com" }),
  );
  await sessao.requisitar({ metodo: "GET", caminho: "/teste" });
  let estado = await aguardar(
    sessao,
    (e) => e.status === "pausado" && e.linha === 5,
  );
  assert.equal(estado.observacoes[0].valor, '"Olá"');
  assert.equal(estado.observacoes[1].valor, '"/teste"');
  await sessao.controlar("continuar");
  estado = await aguardar(sessao, (e) => e.httpResposta?.includes("HTTP 200"));
  assert.match(estado.httpResposta, /Olá/);
});
test("Erro de sintaxe é informado; observação infinita é interrompida e permite continuar", async (t) => {
  const invalida = await criarSessao({
    codigo: "function {",
    breakpoints: {},
    observacoes: [],
  });
  t.after(() => invalida.parar());
  const erro = await aguardar(invalida, (e) => e.status === "erro");
  assert.match(erro.erro, /SyntaxError/);
  const sessao = await criarSessao({
    codigo: "const nome = 'Nina';\nconsole.log(nome);",
    breakpoints: {},
    observacoes: ["(()=>{while(true){}})()"],
  });
  t.after(() => sessao.parar());
  let estado = await aguardar(sessao, (e) => e.status === "pausado");
  assert.equal(estado.observacoes[0].erro, true);
  await sessao.controlar("continuar");
  estado = await aguardar(sessao, (e) => e.status === "concluido");
  assert.deepEqual(estado.saida, ["Nina"]);
});
