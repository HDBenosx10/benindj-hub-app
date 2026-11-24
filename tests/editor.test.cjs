const { test } = require("node:test");
const assert = require("node:assert/strict");
test("Dracula Pro usa rosa sem itálico em const e laranja nos parâmetros", async () => {
  const { colorirJS, regras } = await import("../editor/sintaxe.js");
  const regra = (classe) => regras.find((r) => r.class === classe);
  assert.equal(regra("hl-definition").color, "#ff80bf");
  assert.equal(regra("hl-definition").fontStyle, undefined);
  assert.equal(regra("hl-comment").fontStyle, undefined);
  assert.equal(regra("hl-parameter").color, "#ffca80");
  assert.equal(regra("hl-parameter").fontStyle, "italic");
  const html = colorirJS(
    "const dobro = n => n * 2; function somar(a, b) { return a + b; }",
  );
  assert.match(html, /hl-definition">const</);
  assert.match(html, /hl-parameter">n</);
  assert.match(html, /hl-parameter">a</);
  assert.match(html, /hl-parameter">b</);
  assert.match(html, /hl-operator">=&gt;</);
  assert.match(html, /hl-function">somar</);
});
test("Parser diferencia divisão, regex, comentários e interpolação JavaScript", async () => {
  const { colorirJS } = await import("../editor/sintaxe.js");
  const html = colorirJS(
    "const metade = total / 2; const padrao = /ab+c/gi; const texto = `Olá ${nome.toUpperCase()}`; // explicação",
  );
  assert.match(html, /hl-operator[^>]*>\//);
  assert.match(html, /hl-string[^>]*>\/ab\+c\/gi/);
  assert.match(html, /hl-function[^>]*>toUpperCase/);
  assert.match(html, /hl-comment[^>]*>\/\/ explicação/);
  assert.ok(!html.includes('hl-string">`Olá ${nome.toUpperCase()}`'));
  assert.ok(colorirJS('"<img src=x onerror=alert(1)>"').includes("&lt;img"));
});
test("Prettier formata JavaScript, conserva texto e traduz a posição do cursor", async () => {
  const { formatarTexto } = await import("../editor/formatacao.js");
  const codigo = "function dobrar(n){return n*2}";
  const original = codigo;
  const r = await formatarTexto(
    codigo,
    "exercicio.js",
    codigo.indexOf("return"),
  );
  assert.equal(r.formatted, "function dobrar(n) {\n  return n * 2;\n}\n");
  assert.ok(r.formatted.slice(r.cursorOffset).trimStart().startsWith("return"));
  assert.equal(codigo, original);
});
test("JavaScript inválido não é substituído; JSON tem formatador próprio", async () => {
  const { formatarTexto, podeFormatar } =
    await import("../editor/formatacao.js");
  await assert.rejects(
    () => formatarTexto("function {", "app.cjs"),
    /Unexpected|token|esperado/i,
  );
  assert.equal(
    (await formatarTexto('{"ok":true,"total":2}', "package.json")).formatted,
    '{ "ok": true, "total": 2 }\n',
  );
  assert.equal(podeFormatar("schema.sql"), false);
  assert.equal(podeFormatar("main.cjs"), true);
});
