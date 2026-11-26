"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);
const { exportar } = require("../engine/exportar-projeto.cjs");
test("Projeto exportado extrai, roda fora do Hub e verifica critérios sem gabaritos", async (t) => {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-exportacao-"));
  t.after(() => fs.rm(pasta, { recursive: true, force: true }));
  const aula = JSON.parse(
    await fs.readFile(
      path.resolve(__dirname, "../aulas/aula-00.aula-hub"),
      "utf8",
    ),
  );
  aula.professor = { gabaritos: { segredo: "NAO-DISTRIBUIR-GABARITO" } };
  const pacote = await exportar(aula, {
    codigos: { "hello-world": 'console.log("Hello world!");' },
  });
  const arquivo = path.join(pasta, "projeto.zip");
  await fs.writeFile(arquivo, pacote);
  const destino = path.join(pasta, "extraido");
  await require("extract-zip")(arquivo, { dir: destino });
  assert.equal(
    JSON.parse(await fs.readFile(path.join(destino, "aula.json"), "utf8"))
      .professor,
    undefined,
  );
  const run = await execFile(process.execPath, ["iniciar.cjs"], {
    cwd: destino,
    timeout: 10000,
    windowsHide: true,
  });
  assert.match(run.stdout, /Hello world!/);
  const verificar = await execFile(process.execPath, ["verificar.cjs"], {
    cwd: destino,
    timeout: 10000,
    windowsHide: true,
  });
  assert.match(verificar.stdout, /✓/);
});
test("Código de função recebe recursos SQL na execução livre", async (t) => {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-livre-"));
  t.after(() => fs.rm(pasta, { recursive: true, force: true }));
  const ambiente = await require("../engine/ambiente.cjs").abrirAmbiente(
    pasta,
    {
      versao: 1,
      recursos: [
        {
          id: "sql",
          tipo: "sqlite",
          ddl: "CREATE TABLE teste(id INTEGER);",
          seed: "INSERT INTO teste VALUES(7);",
        },
      ],
    },
  );
  try {
    const r = await require("../engine/executar.cjs").executar(
      'console.log((await recursos.sqlite("sql").consultar("SELECT id FROM teste"))[0].id)',
      5000,
      ambiente.conexao,
    );
    assert.equal(r.erro, null);
    assert.deepEqual(r.saida, ["7"]);
  } finally {
    await ambiente.parar();
  }
});
test("Exportação de função inclui análise técnica offline e rejeita técnica ausente", async (t) => {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-export-tecnica-"));
  t.after(() => fs.rm(pasta, { recursive: true, force: true }));
  const aula = {
    id: "aula-90",
    titulo: "Exemplo técnico",
    schema: 4,
    modo: "funcoes",
    ambiente: { versao: 1, recursos: [] },
    exercicios: [
      {
        id: "dobro",
        codigoInicial: "const dobrar=n=>n*2;",
        experimento: "console.log(dobrar(3));",
        testes: [
          { nome: "Dobro", executar: "return dobrar(3);", esperado: 6 },
          {
            nome: "Arrow",
            executar: "return true;",
            esperado: true,
            tecnica: { versao: 1, funcao: "dobrar", regra: "arrow" },
          },
        ],
      },
    ],
  };
  const arquivo = path.join(pasta, "pacote.zip"),
    destino = path.join(pasta, "extraido");
  await fs.writeFile(arquivo, await exportar(aula, { codigos: {} }));
  await require("extract-zip")(arquivo, { dir: destino });
  const r = await execFile(process.execPath, ["verificar.cjs"], {
    cwd: destino,
    windowsHide: true,
    timeout: 10000,
  });
  assert.match(r.stdout, /✓ Arrow/);
  await fs.writeFile(
    path.join(destino, "exercicios/dobro.js"),
    "function dobrar(n){return n*2;}",
    "utf8",
  );
  await assert.rejects(
    execFile(process.execPath, ["verificar.cjs"], {
      cwd: destino,
      windowsHide: true,
      timeout: 10000,
    }),
    (e) => e.code === 1 && /✗ Arrow/.test(e.stdout),
  );
});
test("Driver exportado preserva recursos e valida configuração sem ser sobrescrito pela entrada", async (t) => {
  const { spawn } = require("node:child_process"),
    { once } = require("node:events");
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-export-driver-"));
  let filho;
  t.after(async () => {
    if (filho && filho.exitCode === null) {
      const acabou = once(filho, "exit");
      filho.kill();
      await acabou;
    }
    assert.ok(pasta.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(pasta, { recursive: true, force: true });
  });
  const aula = {
    id: "aula-91",
    schema: 4,
    titulo: "Driver de projeto",
    modo: "projeto",
    ambiente: {
      versao: 1,
      recursos: [
        {
          id: "externa",
          tipo: "mock-http",
          rotas: [
            {
              metodo: "GET",
              caminho: "/status",
              status: 200,
              corpo: { ok: true },
            },
          ],
        },
      ],
    },
    projeto: {
      tipo: "http",
      arquivos: [
        {
          nome: "app.cjs",
          codigo:
            'const http=require("node:http");exports.criarServidor=async({recursos})=>http.createServer(async(req,res)=>{const r=await fetch(recursos.url("externa")+"/status");res.setHeader("Content-Type","application/json");res.end(JSON.stringify(await r.json()));});',
        },
        {
          nome: "iniciar.cjs",
          codigo:
            'throw new Error("A entrada original deve ser preservada para leitura");',
        },
        {
          nome: "config.cjs",
          codigo:
            'exports.lerConfiguracao=a=>{if(a.PORT==="")throw Error("PORT inválida");return {porta:Number(a.PORT??3000),host:"127.0.0.1"};};',
        },
      ],
      testes: [],
    },
  };
  const arquivo = path.join(pasta, "pacote.zip"),
    destino = path.join(pasta, "extraido");
  await fs.writeFile(arquivo, await exportar(aula, { arquivos: {} }));
  await require("extract-zip")(arquivo, { dir: destino });
  assert.match(
    await fs.readFile(path.join(destino, "entrada.cjs"), "utf8"),
    /preservada para leitura/,
  );
  await assert.rejects(
    execFile(process.execPath, ["iniciar.cjs"], {
      cwd: destino,
      env: { ...process.env, PORT: "" },
      windowsHide: true,
      timeout: 5000,
    }),
    (e) => /PORT inválida/.test(e.stderr),
  );
  filho = spawn(process.execPath, ["iniciar.cjs"], {
    cwd: destino,
    env: { ...process.env, PORT: "0" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const base = await new Promise((resolve, reject) => {
    let texto = "";
    const prazo = setTimeout(() => reject(Error("Driver não iniciou")), 6000);
    filho.stdout.on("data", (d) => {
      texto += d;
      const m = texto.match(/Seu servidor: (http:\/\/127\.0\.0\.1:\d+)/);
      if (m) {
        clearTimeout(prazo);
        resolve(m[1]);
      }
    });
    filho.once("exit", () => {
      clearTimeout(prazo);
      reject(Error("Driver encerrou antes de iniciar"));
    });
  });
  assert.deepEqual(await (await fetch(base + "/integracao")).json(), {
    ok: true,
  });
});
