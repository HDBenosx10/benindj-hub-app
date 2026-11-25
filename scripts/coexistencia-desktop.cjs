"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-coexistencia-"));
  const edicoes = [
    {
      perfil: "aluno",
      exe: path.resolve("dist/win-unpacked/BeninDJ Hub Aluno.exe"),
    },
    {
      perfil: "professor",
      exe: path.resolve(
        "../benindj-hub-professor/dist/win-unpacked/BeninDJ Hub Professor.exe",
      ),
    },
  ];
  async function api(e, p, d) {
    const r = await fetch(e.estado.endereco + p, {
      headers: { "X-Lab-Token": e.token, "Content-Type": "application/json" },
      ...(d === undefined ? {} : { method: "POST", body: JSON.stringify(d) }),
    });
    assert.equal(r.status, 200);
    return r.json();
  }
  async function abrir(e) {
    const relatorio = path.join(pasta, e.perfil + ".json");
    await fs.rm(relatorio, { force: true });
    e.processo = spawn(e.exe, [], {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        HUB_TEST_DATA: path.join(pasta, e.perfil),
        HUB_QA_REPORT: relatorio,
      },
    });
    for (let i = 0; i < 180; i++) {
      try {
        e.estado = JSON.parse(await fs.readFile(relatorio, "utf8"));
        break;
      } catch {}
      if (e.processo.exitCode !== null)
        throw Error("A edição " + e.perfil + " encerrou antes de abrir");
      await pausa(100);
    }
    assert.ok(e.estado, e.perfil + " não iniciou");
    const html = await (await fetch(e.estado.endereco)).text();
    e.token = html.match(/name="lab-token" content="([a-f0-9]+)"/)[1];
    assert.equal((await api(e, "/api/inicio")).perfil, e.perfil);
  }
  async function fechar(e) {
    if (!e.estado || e.processo.exitCode !== null) return;
    await api(e, "/api/encerrar", {});
    for (let i = 0; i < 80 && e.processo.exitCode === null; i++)
      await pausa(100);
    assert.equal(e.processo.exitCode, 0);
  }
  try {
    await Promise.all(edicoes.map(abrir));
    assert.notEqual(edicoes[0].estado.endereco, edicoes[1].estado.endereco);
    assert.notEqual(edicoes[0].estado.dados, edicoes[1].estado.dados);
    for (const e of edicoes) {
      await api(e, "/api/testar", {
        aulaId: "aula-00",
        codigos: {
          "hello-world": `// Resposta exclusiva: ${e.perfil}\nconsole.log("Hello world!");`,
        },
      });
    }
    await fechar(edicoes[0]);
    assert.equal((await api(edicoes[1], "/api/inicio")).perfil, "professor");
    await abrir(edicoes[0]);
    await fechar(edicoes[1]);
    assert.equal((await api(edicoes[0], "/api/inicio")).perfil, "aluno");
    await abrir(edicoes[1]);
    for (const e of edicoes) {
      const a = await api(e, "/api/aula?aula=aula-00");
      assert.ok(JSON.stringify(a).includes("Resposta exclusiva: " + e.perfil));
      assert.ok(
        !JSON.stringify(a).includes(
          "Resposta exclusiva: " +
            (e.perfil === "aluno" ? "professor" : "aluno"),
        ),
      );
    }
    console.log(
      "Coexistência aprovada: dois executáveis abertos ao mesmo tempo, portas e dados distintos, saves separados e encerramento independente. Nenhuma janela visível.",
    );
  } finally {
    for (const e of edicoes)
      await fechar(e).catch(() => {
        e.processo?.kill();
      });
    await fs.rm(pasta, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
