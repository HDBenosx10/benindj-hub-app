const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analisar, conferirArvore } = require("../engine/tecnicas.cjs");
const { avaliar } = require("../engine/motor-exercicios.cjs");
const conteudo = require("../engine/conteudo.js");
const jornada = require("../engine/jornada.cjs");
const regra = (regra, funcao = "resolver") => ({ versao: 1, funcao, regra });
const confere = (codigo, r) => conferirArvore(analisar(codigo), r).passou;
const caso = (r) => ({
  nome: "Técnica exigida",
  executar: "return true;",
  esperado: true,
  tecnica: r,
});
test("Laços aninhados não se confundem com laços irmãos; reverse não é permitido nem em helper interno", () => {
  assert.equal(
    confere(
      "function resolver(v){for(const x of v){for(const y of x){}}return v;}",
      regra("lacos-aninhados"),
    ),
    true,
  );
  assert.equal(
    confere(
      "function resolver(v){for(const x of v){}for(const x of v){}return v;}",
      regra("lacos-aninhados"),
    ),
    false,
  );
  assert.equal(
    confere(
      "function resolver(v){for(const x of v){function ignorada(){while(false){}}}return v;}",
      regra("lacos-aninhados"),
    ),
    false,
  );
  assert.equal(
    confere(
      "function resolver(v){while(v.length>0){break;}return v;}",
      regra("laco"),
    ),
    true,
  );
  assert.equal(
    confere(
      "function resolver(v){const s=[];for(const x of v)s.push(x);return s;}",
      regra("sem-metodo-reverse"),
    ),
    true,
  );
  assert.equal(
    confere(
      'function resolver(v){return v["reverse"]();}',
      regra("sem-metodo-reverse"),
    ),
    false,
  );
  assert.equal(
    confere(
      "function resolver(v){function helper(){return v.reverse();}return helper();}",
      regra("sem-metodo-reverse"),
    ),
    false,
  );
  assert.equal(
    confere(
      'function resolver(v){const texto="v.reverse()";/* .reverse() */return v;}',
      regra("sem-metodo-reverse"),
    ),
    true,
  );
});
test("Arrow é conferida na função indicada; comentário, texto e função decorativa não satisfazem", () => {
  for (const c of [
    "const resolver=x=>x*2;",
    "const resolver = (x) => { return x*2; };",
  ])
    assert.equal(confere(c, regra("arrow")), true);
  for (const c of [
    "function resolver(x){return x*2;} // =>",
    'const texto="const resolver=x=>x*2"; function resolver(x){return x*2;}',
    "function resolver(x){const outra=y=>y;return x*2;}",
    "function decoracao(){const resolver=x=>x*2;} function resolver(x){return x*2;}",
  ])
    assert.equal(confere(c, regra("arrow")), false);
  assert.equal(
    confere("const resolver=function(x){return x*2;}", regra("expressao")),
    true,
  );
  assert.equal(
    confere("function resolver(x){return x*2;}", regra("declaracao")),
    true,
  );
});
test("Laços, await, catch e finally devem estar no próprio corpo da função indicada", () => {
  for (const [codigo, r] of [
    ["function resolver(n){for(let i=0;i<n;i++){}return n;}", "for"],
    ["function resolver(v){for(const x of v){}return v;}", "for-of"],
    ["function resolver(n){while(n>0)n--;return n;}", "while"],
    ["function resolver(n){do{n--;}while(n>0);return n;}", "do-while"],
    ["async function resolver(p){return await p;}", "await"],
    ["async function resolver(p){return p;}", "async"],
    [
      "function resolver(f){try{return f();}catch(e){return null;}}",
      "try-catch",
    ],
    ["function resolver(f){try{return f();}finally{f();}}", "finally"],
    ["function resolver(v){return v.some(x=>x>0);}", "metodo-some"],
    ['function resolver(p){return p["catch"](()=>0);}', "metodo-catch"],
    [
      "function resolver(n){if(n<=0)return 0;return n+resolver(n-1);}",
      "recursao",
    ],
  ])
    assert.equal(confere(codigo, regra(r)), true, r);
  assert.equal(
    confere(
      "function resolver(n){function ignorada(){for(;;){break;}}return n;}",
      regra("for"),
    ),
    false,
  );
  assert.equal(
    confere(
      "function outra(){for(;;){break;}} function resolver(n){return n;}",
      regra("for"),
    ),
    false,
  );
  assert.equal(
    confere(
      "function resolver(f){try{return f();}finally{f();}}",
      regra("try-catch"),
    ),
    false,
  );
  assert.equal(
    confere("function resolver(n){return n;}", regra("recursao")),
    false,
  );
  assert.equal(
    confere("function resolver(v){for(const x of v){}return v;}", regra("for")),
    true,
  );
});
test("Arrow interna deve ser declarada e chamada; forma de retorno respeita o contrato", () => {
  assert.equal(
    confere(
      "function resolver(x){const dobrar=n=>n*2;return dobrar(x);}",
      regra("arrow-interna-expressao"),
    ),
    true,
  );
  assert.equal(
    confere(
      "function resolver(x){const dobrar=n=>{return n*2;};return dobrar(x);}",
      regra("arrow-interna-bloco"),
    ),
    true,
  );
  assert.equal(
    confere(
      "function resolver(x){const dobrar=n=>n*2;return x*2;}",
      regra("arrow-interna"),
    ),
    false,
  );
  assert.equal(
    confere(
      "function resolver(x){const dobrar=n=>{return n*2;};return dobrar(x);}",
      regra("arrow-interna-expressao"),
    ),
    false,
  );
});
test("Motor exige simultaneamente estrutura e comportamento, sem executar código nos casos técnicos", async () => {
  const testes = [
    { nome: "Dobro", executar: "return resolver(3);", esperado: 6 },
    caso(regra("arrow")),
  ];
  const comum = await avaliar("function resolver(x){return x*2;}", testes);
  assert.deepEqual(
    comum.map((r) => r.passou),
    [true, false],
  );
  assert.match(comum[1].recebido, /Arrow/);
  assert.deepEqual(
    (await avaliar("const resolver=x=>x*2;", testes)).map((r) => r.passou),
    [true, true],
  );
  assert.deepEqual(
    (await avaliar("const resolver=x=>0;", testes)).map((r) => r.passou),
    [false, true],
  );
  const sintaxe = await avaliar("const resolver = =>;", testes);
  assert.ok(sintaxe.every((r) => !r.passou));
});
test("Configuração desconhecida ou somente sintática não produz aprovação silenciosa", () => {
  assert.throws(() => conteudo.validarTecnica(regra("inventada")), /técnico/);
  assert.throws(
    () => conteudo.validarTecnica(regra("arrow", "a.b")),
    /técnico/,
  );
  assert.throws(
    () =>
      conteudo.validar({ exercicios: [{ testes: [caso(regra("arrow"))] }] }),
    /comportamento/,
  );
});
test("Alterar a técnica exige nova verificação e conserva o código do aluno", () => {
  const anterior = {
    modo: "funcoes",
    exercicios: [{ id: "x", testes: [caso(regra("arrow"))] }],
  };
  const salvo = { codigos: { x: "const resolver=x=>x;" } };
  jornada.registrar(anterior, salvo, [{ exercicioId: "x", passou: true }], "x");
  const nova = structuredClone(anterior);
  nova.exercicios[0].testes[0].tecnica.regra = "expressao";
  assert.equal(jornada.preservarAprovacoes(anterior, nova, salvo), false);
  assert.equal(jornada.resumo(nova, salvo).completa, false);
  assert.equal(salvo.codigos.x, "const resolver=x=>x;");
});
