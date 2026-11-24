"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
async function smoke() {
  const executavel = path.resolve(
    process.argv[2] ?? "dist/win-unpacked/BeninDJ Hub Aluno.exe",
  );
  const perfil = process.env.HUB_PROFILE ?? "aluno";
  const anterior = process.argv[3] ? path.resolve(process.argv[3]) : null;
  let aberturas = 0;
  const temporaria = await fs.mkdtemp(path.join(os.tmpdir(), "benindj-smoke-"));
  const relatorio = path.join(temporaria, "processo.json");
  const dados = path.join(temporaria, "dados");
  let processo, enderecoAtual;
  const tempos = [];
  async function abrir() {
    await fs.rm(relatorio, { force: true });
    processo = spawn(
      anterior && aberturas++ === 0 ? anterior : executavel,
      [],
      {
        windowsHide: true,
        stdio: "ignore",
        env: { ...process.env, HUB_TEST_DATA: dados, HUB_QA_REPORT: relatorio },
      },
    );
    const limite = Date.now() + 45000;
    while (Date.now() < limite) {
      try {
        const estado = JSON.parse(await fs.readFile(relatorio, "utf8"));
        enderecoAtual = estado.endereco;
        tempos.push(estado.prontoEmMs);
        return estado;
      } catch {}
      if (processo.exitCode !== null)
        throw Error("O executável encerrou antes de ficar pronto.");
      await new Promise((r) => setTimeout(r, 250));
    }
    throw Error("O aplicativo não ficou pronto em 45 segundos.");
  }
  async function api(base, endpoint, dado) {
    const html = await (await fetch(base)).text();
    const token = html.match(/name="lab-token" content="([a-f0-9]+)"/)[1];
    const r = await fetch(base + endpoint, {
      headers: { "X-Lab-Token": token, "Content-Type": "application/json" },
      ...(dado !== undefined
        ? { method: "POST", body: JSON.stringify(dado) }
        : {}),
    });
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  }
  async function fechar(base) {
    const fim = new Promise((r) => processo.once("exit", r));
    await api(base, "/api/encerrar", {});
    await Promise.race([
      fim,
      new Promise((_, rej) =>
        setTimeout(() => rej(Error("O processo não encerrou.")), 8000),
      ),
    ]);
    const saidas = (await fs.readFile(relatorio + ".log", "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse);
    assert.ok(
      saidas.every((s) => s.codigo === 0),
      JSON.stringify(saidas),
    );
  }
  try {
    let estado = await abrir();
    const inicio = await api(estado.endereco, "/api/inicio");
    assert.equal(inicio.perfil, perfil);
    assert.equal(
      inicio.jornada.linguagens.find((l) => l.id === "go").disponivel,
      false,
    );
    await api(estado.endereco, "/api/jornada", {
      trilha: "backend",
      linguagem: "javascript",
    });
    if (perfil === "aluno")
      assert.deepEqual(
        inicio.aulas.map((a) => a.numero),
        [0],
      );
    else assert.ok(inicio.aulas.length >= 46);
    const aula = await api(estado.endereco, "/api/aula?aula=aula-00");
    const codigos = {
      "hello-world":
        '// Resposta do aluno: ação e evolução.\nconsole.log("Hello world!");',
    };
    const resultados = await api(estado.endereco, "/api/testar", {
      aulaId: "aula-00",
      codigos,
    });
    assert.ok(resultados.resultados.every((r) => r.passou));
    assert.equal(resultados.progresso.completa, true);
    if (perfil === "aluno") {
      const importada = {
        ...aula.aula,
        id: "aula-01",
        numero: 1,
        titulo: "Aula liberada no teste",
        ambiente: {
          versao: 1,
          recursos: [
            {
              id: "banco",
              tipo: "sqlite",
              modo: "arquivo",
              ddl: "CREATE TABLE exemplo(id INTEGER);",
              seed: "INSERT INTO exemplo VALUES(1);",
            },
          ],
        },
      };
      await api(estado.endereco, "/api/importar-aula", importada);
      await api(estado.endereco, "/api/ambiente/operar", {
        aulaId: "aula-01",
        operacao: {
          recurso: "banco",
          acao: "sql",
          sql: "UPDATE exemplo SET id=7",
        },
      });
      const livre = await api(estado.endereco, "/api/executar", {
        aulaId: "aula-01",
        codigo:
          'console.log((await recursos.sqlite("banco").consultar("SELECT id FROM exemplo"))[0].id)',
      });
      assert.equal(livre.erro, null);
      assert.deepEqual(livre.saida, ["7"]);
      await fechar(estado.endereco);
      estado = await abrir();
      const reaberto = await api(estado.endereco, "/api/inicio");
      assert.deepEqual(
        reaberto.aulas.map((a) => a.numero),
        [0, 1],
      );
      assert.equal(reaberto.jornada.escolha.trilha, "backend");
      assert.equal(
        reaberto.aulas.find((a) => a.numero === 0).progresso.completa,
        true,
      );
      const persistido = await api(estado.endereco, "/api/ambiente/operar", {
        aulaId: "aula-01",
        operacao: {
          recurso: "banco",
          acao: "sql",
          sql: "SELECT id FROM exemplo",
        },
      });
      assert.equal(persistido.linhas[0].id, 7);
      const salvo = await api(estado.endereco, "/api/aula?aula=aula-00");
      assert.equal(
        salvo.respostas.codigos["hello-world"],
        codigos["hello-world"],
      );
    }
    async function esperarDebug(id, condicao) {
      const prazo = Date.now() + 10000;
      while (Date.now() < prazo) {
        const d = await api(estado.endereco, "/api/debug/estado", {
          aulaId: "aula-00",
          sessaoId: id,
        });
        if (d.status === "erro") throw Error(d.erro);
        if (condicao(d) && !d.inspecionando) return d;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw Error("O debugger empacotado não atingiu a pausa esperada.");
    }
    const dadosDebug = {
      aulaId: "aula-00",
      codigos,
      exercicioId: "hello-world",
      chamadas:
        "let debugContador = 0;\ndebugContador += 1;\nconsole.log(debugContador);",
      breakpoints: { "hello-world.js": [5] },
      observacoes: ["debugContador"],
    };
    let debug = await api(estado.endereco, "/api/debug/iniciar", dadosDebug);
    await esperarDebug(debug.id, (d) => d.status === "pausado");
    await api(estado.endereco, "/api/debug/controle", {
      aulaId: "aula-00",
      sessaoId: debug.id,
      acao: "continuar",
    });
    let pausa = await esperarDebug(
      debug.id,
      (d) => d.status === "pausado" && d.linha === 5,
    );
    assert.equal(pausa.observacoes[0].valor, "0");
    await api(estado.endereco, "/api/debug/controle", {
      aulaId: "aula-00",
      sessaoId: debug.id,
      acao: "proxima",
    });
    pausa = await esperarDebug(
      debug.id,
      (d) => d.status === "pausado" && d.linha === 6,
    );
    assert.equal(pausa.observacoes[0].valor, "1");
    await api(estado.endereco, "/api/debug/controle", {
      aulaId: "aula-00",
      sessaoId: debug.id,
      acao: "continuar",
    });
    const fimDebug = await esperarDebug(
      debug.id,
      (d) => d.status === "concluido",
    );
    assert.deepEqual(fimDebug.saida, ["Hello world!", "1"]);
    const salvoDebug = await api(estado.endereco, "/api/aula?aula=aula-00");
    assert.equal(
      salvoDebug.respostas.codigos["hello-world"],
      codigos["hello-world"],
    );
    assert.equal(
      typeof salvoDebug.respostas.progresso["hello-world"],
      "string",
    );
    const progressoDebug = await api(estado.endereco, "/api/inicio");
    assert.equal(
      progressoDebug.aulas.find((a) => a.id === "aula-00").progresso.completa,
      true,
    );
    // Fechar o app durante uma pausa também deve encerrar o subprocesso.
    debug = await api(estado.endereco, "/api/debug/iniciar", dadosDebug);
    await esperarDebug(debug.id, (d) => d.status === "pausado");
    await fechar(estado.endereco);
    console.log(
      "Smoke desktop aprovado: " +
        perfil +
        ", execução, debug, persistência e encerramento. Abertura do processo Electron (ms): " +
        tempos.join(", "),
    );
    if (anterior)
      console.log(
        "Atualização entre versões aprovada: código com acentos, aulas, progresso e SQLite preservados.",
      );
  } finally {
    if (processo && processo.exitCode === null && enderecoAtual) {
      await api(enderecoAtual, "/api/encerrar", {}).catch(() => {});
    }
    if (processo && processo.exitCode === null) processo.kill();
    assert.ok(temporaria.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(temporaria, { recursive: true, force: true }).catch(() => {});
  }
}
smoke().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
