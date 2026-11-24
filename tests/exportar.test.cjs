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
