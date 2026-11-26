const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { testarProjeto } = require("../engine/projetos.cjs");
const a = "a".repeat(64),
  b = "b".repeat(64);
test("Cenários conservam sessões nomeadas em vez de usar sempre o último login", async () => {
  const codigo = `const http=require('node:http');exports.criarServidor=async()=>http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/sessao-a'||req.url==='/sessao-b'){res.end(JSON.stringify({token:(req.url==='/sessao-a'?'a':'b').repeat(64),expiraEm:Date.now()+60000}));return;}res.end(JSON.stringify({sessao:req.headers.authorization}));});`;
  const aula = {
    projeto: {
      tipo: "http",
      testes: [
        {
          nome: "Duas sessões",
          acoes: [
            { metodo: "GET", caminho: "/sessao-a", token: "a", status: 200 },
            { metodo: "GET", caminho: "/sessao-b", token: "b", status: 200 },
            {
              metodo: "GET",
              caminho: "/quem",
              autorizado: "a",
              status: 200,
              json: { sessao: "Bearer " + a },
            },
            {
              metodo: "GET",
              caminho: "/quem",
              autorizado: "b",
              status: 200,
              json: { sessao: "Bearer " + b },
            },
          ],
        },
      ],
    },
  };
  const r = await testarProjeto(aula, { "app.cjs": codigo });
  assert.ok(
    r.every((t) => t.passou),
    JSON.stringify(r),
  );
});
test("Verificação de logs distingue status final, duração e campos não permitidos", async () => {
  const base = `const http=require('node:http');exports.criarServidor=async()=>http.createServer((req,res)=>{const inicio=performance.now();res.on('finish',()=>console.log(JSON.stringify({metodo:req.method,caminho:new URL(req.url,'http://local').pathname,status:res.statusCode,duracaoMs:Math.round(performance.now()-inicio)})));res.statusCode=req.url==='/ok'?200:404;res.setHeader('Content-Type','application/json');res.end('{}');});`;
  const aula = {
    projeto: {
      tipo: "http",
      testes: [
        {
          nome: "Status real",
          acoes: [
            { metodo: "GET", caminho: "/ok", status: 200 },
            { metodo: "GET", caminho: "/ausente", status: 404 },
          ],
          verificarLogs: true,
        },
      ],
    },
  };
  assert.ok(
    (await testarProjeto(aula, { "app.cjs": base })).every((r) => r.passou),
  );
  for (const errado of [
    base.replace("status:res.statusCode", "status:200"),
    base.replace(
      "duracaoMs:Math.round(performance.now()-inicio)",
      'duracaoMs:"rápido"',
    ),
    base.replace(
      "metodo:req.method",
      'token:"não deve aparecer",metodo:req.method',
    ),
  ])
    assert.ok(
      (await testarProjeto(aula, { "app.cjs": errado })).some((r) => !r.passou),
    );
});
