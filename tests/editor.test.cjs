const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Dracula Pro utiliza o tema original e os escopos TextMate de JavaScript", async () => {
  const { tokens, temaOriginal, colorirJS } = await import("../editor/sintaxe.js");
  assert.equal(temaOriginal.name, "Dracula Pro");
  const linha = tokens("const dobro = n => n * 2;")[0];
  const token = texto => linha.find(t => t.content === texto);
  assert.equal(token("const").color, "#FF80BF");
  assert.equal(token("const").fontStyle, 0);
  assert.equal(token("dobro").color, "#8AFF80");
  assert.equal(token("n").color, "#FFCA80");
  assert.equal(token("n").fontStyle, 1);
  assert.equal(token("=>").color, "#FF80BF");
  const html = colorirJS("// explicação\nconst a = '<img src=x onerror=alert(1)>';");
  assert.match(html, /tm-7970a9-0/);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
});

test("TextMate distingue regex, divisão, escapes, template e membros", async () => {
  const { tokens } = await import("../editor/sintaxe.js");
  const codigo = "const metade = total / 2; const padrao = /ab+c/gi; const texto = `Olá ${nome.toUpperCase()}`;";
  const ts = tokens(codigo).flat();
  assert.ok(ts.some(t => t.content === "/" && t.color === "#FF80BF"));
  assert.ok(ts.some(t => t.content.includes("ab") && t.color === "#FFFF80"));
  assert.ok(ts.some(t => t.content.includes("toUpperCase") && t.color === "#8AFF80"));
  assert.equal(ts.map(t=>t.content).join(""), codigo);
});

test("Entradas reproduzíveis preservam null/undefined e não inventam valores de variáveis locais",async()=>{
  const {chamadasDeTeste,argumentosChamada}=await import("../editor/chamadas.js");
  assert.deepEqual(chamadasDeTeste('return [mesmaMatricula(null,undefined),mesmaMatricula("001",1)];',"mesmaMatricula"),['mesmaMatricula(null,undefined)','mesmaMatricula("001",1)']);
  assert.deepEqual(chamadasDeTeste('const x=3;return f(x);',"f"),[]);
  assert.deepEqual(argumentosChamada('f([1,2], {valor:"a,b"})'),{funcao:"f",argumentos:['[1,2]','{valor:"a,b"}']});
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
