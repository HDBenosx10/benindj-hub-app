const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
test("Trilha criada pelo professor acompanha exportação/importação; histórico persiste separado de aprovações", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hub-percurso-api-")),
    backend = path.join(dir, "backend");
  await fs.cp(path.resolve("engine"), backend, { recursive: true });
  const seed={id:'percurso-635be063-09e0-4e7b-9728-000000000001',nome:'Trilha inicial do acervo',objetivo:'backend',linguagem:'javascript',etapas:[{aulaId:'aula-00',grupo:'Introdução'}]};
  await fs.mkdir(path.join(backend,'conteudo'),{recursive:true});
  await fs.writeFile(path.join(backend,'conteudo/percursos.json'),JSON.stringify([seed]));
  for (const nome of ["autoria", "coruja"])
    await fs.writeFile(
      path.join(backend, nome + ".cjs"),
      "exports.criar=async()=>()=>{};",
    );
  const original = JSON.parse(
    await fs.readFile(path.resolve("aulas/aula-00.aula-hub"), "utf8"),
  );
  const filhos = [];
  t.after(async () => {
    for (const p of filhos) if (p.exitCode === null) p.kill();
    await Promise.all(
      filhos.map((p) =>
        p.exitCode === null
          ? new Promise((r) => p.once("exit", r))
          : Promise.resolve(),
      ),
    );
    await fs.rm(dir, { recursive: true, force: true });
  });
  async function abrir(perfil) {
    const dados = path.join(dir, perfil);
    await fs.mkdir(path.join(dados, "aulas"), { recursive: true });
    await fs.mkdir(path.join(dados, "conteudo"), { recursive: true });
    await fs.writeFile(
      path.join(dados, "config.json"),
      JSON.stringify({ perfil }),
    );
    await fs.writeFile(
      path.join(dados, "aulas/aula-00.hub.json"),
      JSON.stringify(original),
    );
    if (perfil === "professor")
      await fs.writeFile(
        path.join(dados, "conteudo/aulas.json"),
        JSON.stringify([
          original,
          ...[2, 8, 9, 10].map((numero) => ({
            ...original,
            id: "aula-" + String(numero).padStart(2, "0"),
            numero,
            titulo: "Aula " + numero,
            professor: { gabaritos: { segredo: "NAO ENVIAR" } },
          })),
        ]),
      );
    const processo = spawn(
      process.execPath,
      [path.join(backend, "servidor.cjs")],
      {
        windowsHide: true,
        env: {
          ...process.env,
          LAB_NAO_ABRIR: "1",
          LAB_PORT: "0",
          LAB_DATA_DIR: dados,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    filhos.push(processo);
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Timeout de inicialização")),
        10000,
      );
      let texto = "";
      processo.stdout.on("data", (b) => {
        texto += b;
        for (const linha of texto.split("\n"))
          try {
            const d = JSON.parse(linha);
            if (d.endereco) {
              clearTimeout(timer);
              resolve(d.endereco);
              return;
            }
          } catch {}
      });
      processo.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Motor encerrou antes de iniciar"));
      });
    });
    const html = await (await fetch(base)).text(),
      token = html.match(/name="lab-token" content="([a-f0-9]+)"/)[1];
    async function req(p, d) {
      const r = await fetch(base + p, {
        headers: { "X-Lab-Token": token, "Content-Type": "application/json" },
        ...(d === undefined ? {} : { method: "POST", body: JSON.stringify(d) }),
      });
      return { status: r.status, dado: await r.json() };
    }
    return {
      req,
      async fechar() {
        const fim = new Promise((r) => processo.once("exit", r));
        await req("/api/encerrar", {});
        await fim;
      },
    };
  }
  const prof = await abrir("professor");
  assert.equal((await prof.req('/api/percursos')).dado.percursos[0].id,seed.id);
  let aluno = await abrir("aluno");
  const plano = {
    nome: "APIs da turma de terça",
    objetivo: "backend",
    linguagem: "javascript",
    etapas: [
      { aulaId: "aula-10", grupo: "Primeiro módulo" },
      { aulaId: "aula-02", grupo: "Segundo módulo" },
    ],
  };
  const criado = await prof.req("/api/percursos", plano);
  assert.equal(criado.status, 200);
  const id = criado.dado.percursos.find(p=>p.nome===plano.nome).id;
  const exportado = await prof.req("/api/aulas/exportar", {
    ids: ["aula-10", "aula-02"],
  });
  assert.equal(exportado.status, 200);
  assert.ok(!JSON.stringify(exportado.dado).includes("NAO ENVIAR"));
  assert.equal(
    exportado.dado.aulas.find((a) => a.numero === 10).percursos,
    undefined,
  );
  const pre = await aluno.req("/api/inicio");
  assert.equal(pre.dado.jornada.curriculo, undefined);
  assert.equal(pre.dado.jornada.percursos.length, 0);
  const planejamento = await prof.req("/api/percursos/exportar?id=" + id);
  assert.equal(planejamento.status, 200);
  assert.equal(planejamento.dado.etapas[0].aulaId, "aula-10");
  assert.ok(!JSON.stringify(planejamento.dado).includes("exercicios"));
  const p = await aluno.req("/api/aulas/preparar-importacao", {
    fontes: [
      { nome: "curso.trilha-hub", conteudo: JSON.stringify(planejamento.dado) },
    ],
  });
  assert.equal(p.status, 200);
  await aluno.req("/api/aulas/confirmar-importacao", {
    planoId: p.dado.planoId,
    chaves: [0],
  });
  const soPlanejamento = (await aluno.req("/api/inicio")).dado;
  assert.equal(soPlanejamento.aulas.length, 1);
  assert.equal(soPlanejamento.jornada.percursos.length, 1);
  assert.notEqual((await aluno.req("/api/aula?aula=aula-10")).status, 200);
  const preparacao = await aluno.req("/api/aulas/preparar-importacao", {
    fontes: [
      { nome: "trilha.aulas-hub", conteudo: JSON.stringify(exportado.dado) },
    ],
  });
  assert.equal(preparacao.status, 200);
  const importacao = await aluno.req("/api/aulas/confirmar-importacao", {
    planoId: preparacao.dado.planoId,
    chaves: preparacao.dado.linhas.map((l) => l.chave),
  });
  assert.equal(importacao.dado.resumo.importadas, 2);
  let inicio = (await aluno.req("/api/inicio")).dado;
  assert.ok(inicio.aulas.every((a) => !a.estudo.iniciada));
  assert.equal(inicio.jornada.percursos[0].id, id);
  assert.equal((await aluno.req("/api/percursos", plano)).status, 403);
  const pos = await aluno.req("/api/estudo", {
    aulaId: "aula-10",
    aba: "praticar",
    atividadeId: original.exercicios[0].id,
  });
  assert.equal(pos.status, 200);
  await aluno.req("/api/salvar", {
    aulaId: "aula-10",
    codigos: { [original.exercicios[0].id]: 'console.log("minha tentativa");' },
  });
  await aluno.fechar();
  aluno = await abrir("aluno");
  const reaberta = (await aluno.req("/api/aula?aula=aula-10")).dado;
  assert.equal(reaberta.estudo.aba, "praticar");
  assert.equal(reaberta.estudo.iniciada, true);
  assert.equal(
    reaberta.respostas.codigos[original.exercicios[0].id],
    'console.log("minha tentativa");',
  );
  inicio = (await aluno.req("/api/inicio")).dado;
  assert.equal(
    inicio.aulas.find((a) => a.numero === 10).progresso.concluidos,
    0,
  );
  assert.equal(inicio.aulas.find((a) => a.numero === 2).estudo.iniciada, false);
  await aluno.fechar();
  await prof.req('/api/percursos',{...seed,nome:'Edição preservada do professor'});
  await prof.fechar();
  const prof2=await abrir('professor');
  assert.equal((await prof2.req('/api/percursos')).dado.percursos.find(p=>p.id===seed.id).nome,'Edição preservada do professor');
  await prof2.fechar();
});
