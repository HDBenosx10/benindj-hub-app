"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { avaliarComAmbiente } = require("./avaliacao-ambiente.cjs");
const { validarAmbiente, validarMateriais } = require("./ambiente-schema.cjs");
const projetos = require("./projetos.cjs");
const oficinas = require("./oficinas.cjs");

async function lerJson(caminho) {
  return JSON.parse(
    (await fs.readFile(caminho, "utf8")).replace(/^\uFEFF/, ""),
  );
}
function publico(aula) {
  return Object.fromEntries(
    Object.entries(aula).filter(([campo]) => campo !== "professor"),
  );
}
function validarAula(aula) {
  if (
    aula?.schema !== 3 ||
    !/^aula-\d{2}$/.test(aula.id) ||
    typeof aula.titulo !== "string" ||
    Object.hasOwn(aula, "professor")
  ) {
    throw new Error(
      "Escolha um arquivo de aula liberado pelo professor, com extensão .aula-hub.",
    );
  }
  if (!["funcoes", "projeto"].includes(aula.modo)) {
    throw new Error("Formato de aula desconhecido.");
  }
  if (aula.modo === "funcoes" && !Array.isArray(aula.exercicios)) {
    throw new Error("Aula sem desafios.");
  }
  if (
    aula.modo === "projeto" &&
    (!Array.isArray(aula.projeto?.arquivos) ||
      !Array.isArray(aula.projeto?.testes))
  ) {
    throw new Error("Projeto sem arquivos e cenários.");
  }
  if (
    aula.modo === "projeto" &&
    aula.projeto.arquivos.some(
      (f) =>
        !f ||
        !/^[a-z0-9-]+\.(cjs|js|sql|json)$/.test(f.nome) ||
        typeof f.codigo !== "string",
    )
  )
    throw Error("Arquivo de projeto inválido.");
  if (
    aula.modo === "funcoes" &&
    aula.exercicios.some((e) => !e || !/^[a-zA-Z][\w-]{0,60}$/.test(e.id))
  )
    throw Error("Identificador de exercício inválido.");
  validarAmbiente(aula.ambiente);
  require("./conteudo.js").validar(aula);
  validarMateriais(aula.materiaisComplementares);
  return aula;
}

function abrirNavegador(endereco) {
  if (process.platform === "win32" && process.env.LAB_NAO_ABRIR !== "1") {
    const app = require("node:child_process").spawn(
      "explorer.exe",
      [endereco],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    app.on("error", () => {});
  }
}

async function iniciar() {
  const raiz = process.env.LAB_DATA_DIR ?? __dirname;
  const config = await lerJson(path.join(raiz, "config.json"));
  const professor = config.perfil === "professor";
  const catalogo = new Map();
  const liberadas = new Map();
  if (professor) {
    for (const aula of await lerJson(
      path.join(raiz, "conteudo", "aulas.json"),
    )) {
      catalogo.set(aula.id, aula);
    }
  }
  await fs.mkdir(path.join(raiz, "aulas"), { recursive: true });
  for (const nome of await fs.readdir(path.join(raiz, "aulas"))) {
    if (/^aula-\d{2}\.(?:hub|acai)\.json$/.test(nome)) {
      const aula = validarAula(await lerJson(path.join(raiz, "aulas", nome)));
      liberadas.set(aula.id, aula);
    }
  }
  const autoria = professor
    ? await require("./autoria.cjs").criar(raiz, catalogo)
    : null;
  const coruja = professor ? await require("./coruja.cjs").criar(raiz) : null;
  const token = crypto.randomBytes(24).toString("hex");
  const identidade = crypto.createHash("sha256").update(raiz).digest("hex");
  const pastaDados = path.join(raiz, ".dados");
  await fs.mkdir(pastaDados, { recursive: true });
  const caminhoInstancia = path.join(pastaDados, "instancia.json");
  try {
    const instancia = await lerJson(caminhoInstancia);
    if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(instancia.endereco)) {
      throw new Error("Instância local inválida.");
    }
    const resposta = await fetch(instancia.endereco + "/api/identidade", {
      signal: AbortSignal.timeout(600),
    });
    const dado = await resposta.json();
    if (dado.identidade === identidade && dado.versao === 3) {
      abrirNavegador(instancia.endereco);
      console.log(
        JSON.stringify({
          endereco: instancia.endereco,
          reutilizado: true,
          pid: instancia.pid,
        }),
      );
      return;
    }
  } catch {}
  const caminhoRespostas = path.join(pastaDados, "respostas.json");
  let respostas = {};
  try {
    respostas = await lerJson(caminhoRespostas);
  } catch (erro) {
    if (erro.code !== "ENOENT") {
      throw new Error(
        "Não foi possível ler as respostas. O arquivo .dados/respostas.json foi preservado.",
      );
    }
  }
  let gravacao = Promise.resolve();
  const jornada = require("./jornada.cjs");
  const percurso = require("./percurso.js");
  const planosProfessor = () => respostas["percursos:professor"] ?? [];
  const aulaParaAluno = (a) => publico(a);
  const trilhasRecebidas = new Map(
    (respostas["percursos:aluno"] ?? []).map((p) => [p.id, p]),
  );
  async function persistir() {
    const texto = JSON.stringify(respostas, null, 2);
    gravacao = gravacao
      .catch(() => {})
      .then(async () => {
        await fs.writeFile(caminhoRespostas + ".tmp", texto, "utf8");
        await fs.rename(caminhoRespostas + ".tmp", caminhoRespostas);
      });
    await gravacao;
  }
  if (professor) {
    let iniciais = [];
    try {
      iniciais = await lerJson(
        path.join(__dirname, "conteudo", "percursos.json"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    let alterado = false;
    for (const p of iniciais) {
      percurso.manifesto(p, [...catalogo.values()]);
      if (!planosProfessor().some((atual) => atual.id === p.id)) {
        respostas["percursos:professor"] = [...planosProfessor(), p];
        alterado = true;
      }
    }
    if (alterado) await persistir();
  }
  const ativos = new Map();
  const ambientes = require("./ambiente-gerenciador.cjs").criarGerenciador(
    path.join(pastaDados, "ambientes"),
  );
  let conferindo = false;
  const depuracoes = new Map();
  let iniciandoDebug = false;
  let encerrando = false;
  const importadorAulas = require("./pacotes-aulas.cjs").criarImportador({
    aulas: liberadas,
    pasta: path.join(raiz, "aulas"),
    validarAula,
    trilhas: trilhasRecebidas,
    salvarTrilha: async (trilha) => {
      const atuais = respostas["percursos:aluno"] ?? [];
      respostas["percursos:aluno"] = [
        ...atuais.filter((p) => p.id !== trilha.id),
        trilha,
      ];
      await persistir();
    },
    antesDeAtualizar: async (id, anterior, nova) => {
      await pararChave(`aluno:${id}`);
      if (JSON.stringify(anterior.ambiente) !== JSON.stringify(nova.ambiente))
        await ambientes.parar(`aluno:${id}`);
    },
    depoisDeAtualizar: async (id, anterior, nova) => {
      const chave = `aluno:${id}`,
        original = respostas[chave];
      if (!original) return;
      const migrado = structuredClone(original);
      if (!jornada.preservarAprovacoes(anterior, nova, migrado)) return;
      respostas[chave] = migrado;
      try {
        await persistir();
      } catch (erro) {
        respostas[chave] = original;
        throw erro;
      }
    },
  });

  function visao(req) {
    return professor && req.headers["x-lab-visao"] !== "aluno"
      ? "professor"
      : "aluno";
  }
  function lista(req) {
    return visao(req) === "professor" ? catalogo : liberadas;
  }
  function aulaPorId(req, id) {
    // A prévia abre uma aula selecionada pelo professor, com projeção pública do conteúdo.
    const mapa = professor ? catalogo : liberadas;
    const aula = mapa.get(id);
    if (!aula) {
      throw new Error("Esta aula ainda não foi liberada neste motor.");
    }
    return aula;
  }
  function chave(req, aula) {
    return `${visao(req)}:${aula.id}`;
  }
  function pastaProjeto(req, aula, demo = false) {
    return path.join(
      pastaDados,
      "projetos",
      visao(req),
      aula.id + (demo ? "-demo" : ""),
    );
  }
  function dadosDaAula(req, aula) {
    const salvo = respostas[chave(req, aula)] ?? {};
    const codigos = {};
    for (const exercicio of aula.exercicios ?? []) {
      codigos[exercicio.id] =
        salvo.codigos?.[exercicio.id] ?? exercicio.codigoInicial;
    }
    const arquivos = {};
    for (const arquivo of aula.projeto?.arquivos ?? []) {
      arquivos[arquivo.nome] = arquivo.editavel
        ? (salvo.arquivos?.[arquivo.nome] ?? arquivo.codigo)
        : arquivo.codigo;
    }
    return {
      codigos,
      arquivos,
      experimentos: salvo.experimentos ?? {},
      progresso: salvo.progresso ?? {},
      estudo: salvo.estudo ?? null,
    };
  }
  async function salvar(req, aula, dado) {
    const anterior = dadosDaAula(req, aula);
    for (const exercicio of aula.exercicios ?? []) {
      if (
        typeof dado.codigos?.[exercicio.id] === "string" &&
        dado.codigos[exercicio.id].length <= 100000
      ) {
        anterior.codigos[exercicio.id] = dado.codigos[exercicio.id];
      }
    }
    for (const arquivo of aula.projeto?.arquivos ?? []) {
      if (
        arquivo.editavel &&
        typeof dado.arquivos?.[arquivo.nome] === "string" &&
        dado.arquivos[arquivo.nome].length <= 150000
      ) {
        anterior.arquivos[arquivo.nome] = dado.arquivos[arquivo.nome];
      }
    }
    if (dado.experimentos && typeof dado.experimentos === "object") {
      for (const [nome, texto] of Object.entries(dado.experimentos)) {
        if (
          /^[a-zA-Z0-9_-]{1,70}$/.test(nome) &&
          typeof texto === "string" &&
          texto.length <= 100000
        ) {
          anterior.experimentos[nome] = texto;
        }
      }
    }
    respostas[chave(req, aula)] = anterior;
    await persistir();
    return anterior;
  }
  function json(res, status, dado) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${token}'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
    });
    res.end(JSON.stringify(dado));
  }
  async function corpo(req) {
    const partes = [];
    let tamanho = 0;
    for await (const parte of req) {
      tamanho += parte.length;
      const limite =
        req.url === "/api/aulas/preparar-importacao" ? 96_000_000 : 4_000_000;
      if (tamanho > limite) {
        throw new Error(`O envio excede o limite de ${limite / 1_000_000} MB.`);
      }
      partes.push(parte);
    }
    return JSON.parse(
      Buffer.concat(partes)
        .toString("utf8")
        .replace(/^\uFEFF/, ""),
    );
  }
  async function pararChave(id) {
    await depuracoes.get(id)?.parar();
    depuracoes.delete(id);
    const ativo = ativos.get(id);
    if (ativo) {
      await ativo.projeto.parar();
      ativos.delete(id);
    }
  }

  const servidor = http.createServer((req, res) => {
    async function atender() {
      const url = new URL(req.url, "http://localhost");
      if (encerrando) {
        res.setHeader("Connection", "close");
        return json(res, 503, { erro: "O aplicativo está encerrando." });
      }
      if (req.method === "GET" && url.pathname === "/api/identidade") {
        return json(res, 200, { identidade, versao: 3 });
      }
      const estaticos = {
        "/": "index.html",
        "/interface.js": "interface.js",
        "/vendor/editor.js": "vendor/editor.js",
        "/vendor/editor-tema.css": "vendor/editor-tema.css",
        "/ambiente-ui.js": "ambiente-ui.js",
        "/jornada-ui.js": "jornada-ui.js",
        "/percurso.js": "percurso.js",
        "/percurso-ui.js": "percurso-ui.js",
        "/debug-ui.js": "debug-ui.js",
        "/conteudo.js": "conteudo.js",
        "/leitura-ui.js": "leitura-ui.js",
        "/lotes-ui.js": "lotes-ui.js",
        "/nuvem-ui.js": "nuvem-ui.js",
        "/acervo-atualizacoes.js": "acervo-atualizacoes.js",
        "/estilo.css": "estilo.css",
        ...(professor
          ? {
              "/estudio.js": "estudio.js",
              "/estudio-recursos.js": "estudio-recursos.js",
            }
          : {}),
      };
      if (req.method === "GET" && estaticos[url.pathname]) {
        const nome = estaticos[url.pathname];
        const tipo = nome.endsWith(".html")
          ? "text/html"
          : nome.endsWith(".js")
            ? "text/javascript"
            : "text/css";
        const texto = (await fs.readFile(path.join(__dirname, nome), "utf8"))
          .replace("__TOKEN__", token)
          .replace(
            "__ESTUDIO__",
            professor
              ? '<script src="/estudio.js" defer></script><script src="/estudio-recursos.js" defer></script>'
              : "",
          );
        res.writeHead(200, {
          "Content-Type": tipo + "; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${token}'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
        });
        res.end(texto);
        return;
      }
      if (
        req.headers["x-lab-token"] !== token ||
        (req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`)
      ) {
        return json(res, 403, {
          erro: "Abra o aplicativo BeninDJ Hub novamente.",
        });
      }
      if (req.method === "POST" && url.pathname === "/api/jornada") {
        const escolha = jornada.validarEscolha(await corpo(req));
        respostas["jornada:" + visao(req)] = escolha;
        await persistir();
        return json(res, 200, { escolha });
      }
      if (url.pathname === "/api/percursos/exportar") {
        if (visao(req) !== "professor")
          return json(res, 403, {
            erro: "Somente o professor exporta planejamentos.",
          });
        const plano = planosProfessor().find(
          (p) => p.id === url.searchParams.get("id"),
        );
        if (!plano) throw Error("Trilha não encontrada.");
        return json(
          res,
          200,
          percurso.manifesto(plano, [...catalogo.values()]),
        );
      }
      if (url.pathname === "/api/percursos") {
        if (visao(req) !== "professor")
          return json(res, 403, {
            erro: "Somente o professor organiza trilhas.",
          });
        if (req.method === "GET")
          return json(res, 200, { percursos: planosProfessor() });
        if (req.method !== "POST") throw Error("Use GET ou POST.");
        const d = await corpo(req),
          atuais = planosProfessor();
        if (d.acao === "excluir") {
          respostas["percursos:professor"] = atuais.filter(
            (p) => p.id !== d.id,
          );
        } else {
          const validado = percurso.validar(d, [...catalogo.keys()]);
          if (d.id && !atuais.some((p) => p.id === d.id))
            throw Error("Trilha não encontrada.");
          if (!d.id && atuais.length >= 100)
            throw Error("Limite de 100 trilhas por acervo.");
          const p = {
            ...validado,
            id: d.id ?? "percurso-" + crypto.randomUUID(),
          };
          respostas["percursos:professor"] = [
            ...atuais.filter((a) => a.id !== p.id),
            p,
          ];
        }
        await persistir();
        return json(res, 200, { percursos: planosProfessor() });
      }
      if (req.method === "GET" && url.pathname === "/api/inicio") {
        let mapa = lista(req);
        if (
          professor &&
          visao(req) === "aluno" &&
          url.searchParams.has("aula")
        ) {
          const aula = catalogo.get(url.searchParams.get("aula"));
          mapa = new Map(aula ? [[aula.id, aula]] : []);
        }
        return json(res, 200, {
          perfil: visao(req),
          versaoApp: config.versaoApp,
          jornada: {
            escolha: respostas["jornada:" + visao(req)] ?? null,
            trilhas: jornada.trilhas,
            linguagens: jornada.linguagens,
            percursos:
              visao(req) === "professor"
                ? planosProfessor()
                : [...trilhasRecebidas.values()],
          },
          aulas: [...mapa.values()].map((aula) => ({
            id: aula.id,
            numero: aula.numero,
            titulo: aula.titulo,
            foco: aula.foco,
            modo: aula.modo,
            modulo: aula.modulo,
            trilha: jornada.trilhaDaAula(aula),
            progresso: jornada.resumo(aula, dadosDaAula(req, aula)),
            revisaoOnline: aula.distribuicao?.dados?.revisao ?? null,
            percursos:
              visao(req) === "professor"
                ? percurso.descrever(planosProfessor(), aula.id)
                : (aula.percursos ?? []),
            estudo: jornada.posicao(aula, dadosDaAula(req, aula)),
          })),
          versao: 3,
        });
      }
      if (req.method === "GET" && url.pathname === "/api/motor-aluno") {
        if (visao(req) !== "professor") {
          return json(res, 403, { erro: "Recurso do professor." });
        }
        return json(res, 200, {
          url: config.urlReleases ?? null,
          instrucoes:
            "Envie o executável BeninDJ-Hub-Aluno da release uma vez. Depois envie somente cada arquivo .aula-hub. O aplicativo já contém seu próprio motor.",
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/importar-aula") {
        if (professor) {
          throw new Error(
            "Use o botão de prévia para apresentar uma aula do seu catálogo.",
          );
        }
        const aula = validarAula(await corpo(req));
        const plano = importadorAulas.preparar([
          { nome: aula.id + ".aula-hub", conteudo: JSON.stringify(aula) },
        ]);
        if (plano.linhas[0].situacao !== "igual") {
          const resultado = await importadorAulas.confirmar(plano.planoId, [0]);
          if (resultado.resumo.falhas)
            throw Error(resultado.resultados[0].motivo);
        }
        return json(res, 200, { id: aula.id, titulo: aula.titulo });
      }
      if (req.method === "POST" && url.pathname === "/api/encerrar") {
        encerrando = true;
        const enviada = new Promise((resolve) => res.once("finish", resolve));
        json(res, 200, { ok: true });
        await enviada;
        for (const id of [...ativos.keys()]) {
          await pararChave(id);
        }
        for (const debug of depuracoes.values()) await debug.parar();
        depuracoes.clear();
        await ambientes.encerrar();
        await gravacao;
        servidor.close(() => {
          process.exitCode = 0;
        });
        servidor.closeAllConnections();
        return;
      }
      const dado = req.method === "POST" ? await corpo(req) : {};
      if (req.method === "POST" && url.pathname === "/api/aulas/exportar") {
        if (visao(req) !== "professor")
          return json(res, 403, { erro: "Exportação exclusiva do professor." });
        const pacote = require("./pacotes-aulas.cjs").montarPacote(
          catalogo,
          dado.ids,
          aulaParaAluno,
        );
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="BeninDJ-Hub-${pacote.aulas.length}-aulas.aulas-hub"`,
          "Cache-Control": "no-store",
        });
        return res.end("\uFEFF" + JSON.stringify(pacote, null, 2));
      }
      if (
        req.method === "POST" &&
        [
          "/api/aulas/preparar-importacao",
          "/api/aulas/confirmar-importacao",
        ].includes(url.pathname)
      ) {
        if (professor)
          return json(res, 403, {
            erro: "Importe as aulas na edição Aluno. No Professor, use o acervo e a prévia.",
          });
        return json(
          res,
          200,
          url.pathname.endsWith("preparar-importacao")
            ? importadorAulas.preparar(dado.fontes)
            : await importadorAulas.confirmar(dado.planoId, dado.chaves),
        );
      }
      if (
        url.pathname.startsWith("/api/autoria/") ||
        url.pathname.startsWith("/api/coruja/")
      ) {
        if (visao(req) !== "professor") {
          return json(res, 403, { erro: "Recurso exclusivo do professor." });
        }
        const operacao = url.pathname.split("/").pop();
        if (url.pathname.startsWith("/api/coruja/")) {
          return json(res, 200, await coruja(operacao, dado));
        }
        return json(res, 200, await autoria(operacao, dado));
      }
      const aula = aulaPorId(req, dado.aulaId ?? url.searchParams.get("aula"));
      const id = chave(req, aula);
      if (url.pathname.startsWith("/api/debug/")) {
        if (req.method !== "POST")
          throw Error("Use POST para operar o debugger.");
        const acao = url.pathname.split("/").pop();
        if (acao === "iniciar") {
          if (iniciandoDebug) throw Error("Aguarde a sessão de debug iniciar.");
          iniciandoDebug = true;
          try {
            for (const [chaveDebug, sessaoDebug] of depuracoes)
              if (chaveDebug.startsWith(visao(req) + ":")) {
                await sessaoDebug.parar();
                depuracoes.delete(chaveDebug);
              }
            await pararChave(id);
            const salvo = await salvar(req, aula, dado);
            const conexao = (await ambientes.obter(id, aula))?.conexao;
            const opcoes = {
              conexao,
              breakpoints: dado.breakpoints,
              observacoes: dado.observacoes,
            };
            if (aula.modo === "funcoes") {
              const exercicio = aula.exercicios.find(
                (e) => e.id === dado.exercicioId,
              );
              if (!exercicio)
                throw Error("Escolha uma atividade para depurar.");
              if (
                typeof dado.chamadas !== "string" ||
                dado.chamadas.length > 100000
              )
                throw Error("Chamadas de depuração inválidas.");
              opcoes.arquivo = exercicio.id + ".js";
              opcoes.codigo =
                salvo.codigos[exercicio.id] + "\n;\n" + dado.chamadas;
            } else {
              const arquivos = projetos.montarArquivos(aula, salvo.arquivos);
              opcoes.http = aula.projeto.tipo === "http";
              opcoes.arquivo = opcoes.http
                ? "app.cjs"
                : Object.hasOwn(arquivos, "main.cjs")
                  ? "main.cjs"
                  : dado.arquivo;
              if (
                !Object.hasOwn(arquivos, opcoes.arquivo) ||
                !/\.(js|cjs)$/.test(opcoes.arquivo)
              )
                throw Error("Selecione um arquivo JavaScript executável.");
              opcoes.pasta = path.join(pastaProjeto(req, aula), "debug");
              opcoes.arquivos = Object.keys(arquivos);
              await projetos.prepararPasta(opcoes.pasta, arquivos);
              const compartilhado = conexao?.recursos.find(
                (r) =>
                  r.id === "banco" &&
                  r.tipo === "sqlite" &&
                  r.modo === "arquivo",
              );
              opcoes.banco = compartilhado
                ? await require("./recursos-cliente.cjs")
                    .criarCliente(conexao)
                    .sqlite("banco")
                    .caminhoArquivo()
                : path.join(pastaProjeto(req, aula), "hub.sqlite");
            }
            const debug = await require("./depurador.cjs").criarSessao(opcoes);
            depuracoes.set(id, debug);
            return json(res, 200, debug.estado());
          } finally {
            iniciandoDebug = false;
          }
        }
        const debug = depuracoes.get(id);
        if (!debug || debug.id !== dado.sessaoId)
          throw Error("Sessão de debug encerrada. Inicie uma nova sessão.");
        if (acao === "controle") await debug.controlar(dado.acao, dado.quadro);
        else if (acao === "configurar")
          await debug.configurar(dado.breakpoints, dado.observacoes);
        else if (acao === "requisitar") await debug.requisitar(dado.requisicao);
        else if (acao !== "estado")
          throw Error("Operação de debug desconhecida.");
        debug.renovar();
        return json(res, 200, debug.estado());
      }
      if (req.method === "GET" && url.pathname === "/api/aula") {
        // Reabrir a aula após recarregar a janela encerra sessões sem interface.
        for (const [chaveDebug, sessaoDebug] of depuracoes)
          if (chaveDebug.startsWith(visao(req) + ":")) {
            await sessaoDebug.parar();
            depuracoes.delete(chaveDebug);
          }
        await ambientes.obter(id, aula);
        return json(res, 200, {
          aula: visao(req) === "professor" ? aula : publico(aula),
          respostas: dadosDaAula(req, aula),
          estudo: jornada.posicao(aula, dadosDaAula(req, aula)),
        });
      }
      if (req.method === "GET" && url.pathname === "/api/exportar-aula") {
        if (visao(req) !== "professor") {
          return json(res, 403, { erro: "Recurso do professor." });
        }
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${aula.id}.aula-hub"`,
        });
        res.end("\uFEFF" + JSON.stringify(aulaParaAluno(aula), null, 2));
        return;
      }
      if (url.pathname.startsWith("/api/ambiente/")) {
        if (req.method !== "POST")
          throw Error("Use POST para operar o ambiente.");
        if (!aula.ambiente)
          throw Error("O professor não habilitou recursos nesta aula.");
        let ambiente;
        if (dado.demonstracao && visao(req) !== "professor")
          throw Error("Demonstração exclusiva do professor.");
        const ambienteId = id + (dado.demonstracao ? "-demo" : "");
        if (url.pathname === "/api/ambiente/configurar") {
          await pararChave(id);
          ambiente = await ambientes.configurar(
            ambienteId,
            aula,
            dado.definicao,
          );
        } else if (url.pathname === "/api/ambiente/restaurar") {
          await pararChave(id);
          ambiente = await ambientes.restaurar(ambienteId, aula);
        } else if (url.pathname === "/api/ambiente/reiniciar") {
          await pararChave(id);
          await ambientes.parar(ambienteId);
          ambiente = await ambientes.obter(ambienteId, aula);
        } else if (url.pathname === "/api/ambiente/parar") {
          await pararChave(id);
          await ambientes.parar(id);
          await ambientes.parar(id + "-demo");
          return json(res, 200, { parado: true });
        } else if (url.pathname === "/api/ambiente/operar") {
          ambiente = await ambientes.obter(ambienteId, aula);
          return json(res, 200, await ambiente.operar(dado.operacao));
        } else if (url.pathname === "/api/ambiente/estado")
          ambiente = await ambientes.obter(ambienteId, aula);
        else throw Error("Operação de ambiente desconhecida.");
        const estado = await ambiente.operar({ acao: "estado" });
        return json(res, 200, {
          ...estado,
          recursos: estado.recursos.map((r) => ({
            ...r,
            ...(r.tipo === "mock-http"
              ? { url: ambiente.conexao.base + "/mock/" + r.id }
              : {}),
          })),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/exportar-projeto") {
        const salvo = await salvar(req, aula, dado);
        const pacote = await require("./exportar-projeto.cjs").exportar(
          aula,
          salvo,
          await ambientes.configuracao(id, aula),
        );
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${aula.id}-projeto.zip"`,
        });
        res.end(pacote);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/salvar") {
        const salvo = await salvar(req, aula, dado);
        return json(res, 200, {
          salvo: true,
          respostas: salvo,
          progresso: jornada.resumo(aula, salvo),
          estudo: jornada.posicao(aula, salvo),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/estudo") {
        const salvo = dadosDaAula(req, aula),
          estudo = jornada.registrarEstudo(aula, salvo, dado);
        respostas[chave(req, aula)] = salvo;
        await persistir();
        return json(res, 200, { estudo });
      }
      if (req.method === "POST" && url.pathname === "/api/executar") {
        if (typeof dado.codigo !== "string" || dado.codigo.length > 200000) {
          throw new Error("Programa ausente ou muito grande.");
        }
        return json(
          res,
          200,
          await require("./executar.cjs").executar(
            dado.codigo,
            5000,
            (await ambientes.obter(id, aula))?.conexao,
          ),
        );
      }
      if (req.method === "POST" && url.pathname === "/api/testar") {
        if (conferindo) {
          return json(res, 409, {
            erro: "Aguarde a verificação em andamento.",
          });
        }
        conferindo = true;
        try {
          const salvo = await salvar(req, aula, dado);
          let resultados;
          if (aula.modo === "funcoes") {
            const exercicios = dado.exercicioId
              ? aula.exercicios.filter((e) => e.id === dado.exercicioId)
              : aula.exercicios;
            if (!exercicios.length) {
              throw new Error("Exercício inexistente.");
            }
            resultados = [];
            for (const exercicio of exercicios) {
              const retorno = await avaliarComAmbiente(
                salvo.codigos[exercicio.id],
                exercicio.testes,
                aula.ambiente,
              );
              resultados.push(
                ...retorno.map((item) => ({
                  ...item,
                  exercicioId: exercicio.id,
                })),
              );
            }
          } else {
            const arquivos = projetos.montarArquivos(aula, salvo.arquivos);
            resultados =
              aula.projeto.tipo === "http"
                ? await projetos.testarProjeto(aula, arquivos)
                : await oficinas.testarOficina(
                    aula,
                    arquivos,
                    pastaProjeto(req, aula),
                  );
          }
          const progresso = jornada.registrar(
            aula,
            salvo,
            resultados,
            dado.exercicioId,
          );
          respostas[chave(req, aula)] = salvo;
          await persistir();
          return json(res, 200, { resultados, progresso });
        } finally {
          conferindo = false;
        }
      }
      if (req.method === "POST" && url.pathname === "/api/exemplo") {
        if (aula.modo !== "funcoes") {
          throw new Error("Execute o projeto para observar esta demonstração.");
        }
        const resultados = await avaliarComAmbiente(
          aula.exemplo,
          [{ nome: "Demonstração", executar: "return true;", esperado: true }],
          aula.ambiente,
        );
        return json(res, 200, { resultados });
      }
      if (req.method === "POST" && url.pathname === "/api/projeto/iniciar") {
        if (aula.projeto?.tipo !== "http") {
          throw new Error(
            "Esta aula executa um programa pelo terminal integrado.",
          );
        }
        if (dado.demonstracao && visao(req) !== "professor") {
          return json(res, 403, {
            erro: "Demonstração exclusiva do professor.",
          });
        }
        const salvo = await salvar(req, aula, dado);
        await pararChave(id);
        const arquivos = projetos.montarArquivos(
          aula,
          salvo.arquivos,
          Boolean(dado.demonstracao),
        );
        const projeto = await projetos.abrirProjeto(
          pastaProjeto(req, aula, Boolean(dado.demonstracao)),
          arquivos,
          {
            conexao: (
              await ambientes.obter(
                id + (dado.demonstracao ? "-demo" : ""),
                aula,
              )
            )?.conexao,
          },
        );
        ativos.set(id, { projeto, demonstracao: Boolean(dado.demonstracao) });
        return json(res, 200, {
          base: projeto.base,
          demonstracao: Boolean(dado.demonstracao),
          logs: projeto.logs,
        });
      }
      if (req.method === "POST" && url.pathname === "/api/projeto/parar") {
        await pararChave(id);
        return json(res, 200, { parado: true });
      }
      if (req.method === "POST" && url.pathname === "/api/projeto/requisitar") {
        const ativo = ativos.get(id);
        if (!ativo) {
          throw new Error(
            "Clique em Executar projeto antes de enviar uma requisição.",
          );
        }
        const resposta = await projetos.requisitar(
          ativo.projeto,
          dado.requisicao,
        );
        await ativo.projeto.modulo(null, null, []);
        return json(res, 200, { ...resposta, logs: ativo.projeto.logs });
      }
      if (req.method === "POST" && url.pathname === "/api/projeto/cliente") {
        const ativo = ativos.get(id);
        if (
          !ativo ||
          !aula.projeto.arquivos.some((f) => f.nome === "cliente.cjs")
        ) {
          throw new Error("Inicie o projeto que contém cliente.cjs.");
        }
        const valor = await ativo.projeto.modulo(
          "cliente.cjs",
          "consultarProdutos",
          [ativo.projeto.base, dado.token],
        );
        return json(res, 200, { valor, logs: ativo.projeto.logs });
      }
      if (req.method === "POST" && url.pathname === "/api/projeto/sql") {
        const ativo = ativos.get(id);
        if (!ativo || !aula.projeto.usaBanco) {
          throw new Error("Execute o projeto com SQLite antes de consultar.");
        }
        if (
          typeof dado.sql !== "string" ||
          !/^\s*SELECT\s/i.test(dado.sql) ||
          dado.sql.length > 5000
        ) {
          throw new Error("Use uma consulta SELECT para observar o banco.");
        }
        const { DatabaseSync } = require("node:sqlite");
        const banco = new DatabaseSync(ativo.projeto.banco, { readOnly: true });
        try {
          return json(res, 200, { linhas: banco.prepare(dado.sql).all() });
        } finally {
          banco.close();
        }
      }
      if (req.method === "POST" && url.pathname === "/api/comando") {
        if (!aula.projeto || aula.projeto.tipo === "http") {
          throw new Error("Esta aula usa o explorador HTTP.");
        }
        const definicao = aula.projeto.comandos.find(
          (item) => item.id === dado.comandoId,
        );
        if (!definicao) {
          throw new Error("Escolha um dos comandos previstos na aula.");
        }
        if (dado.demonstracao && visao(req) !== "professor") {
          return json(res, 403, { erro: "Recurso do professor." });
        }
        const salvo = await salvar(req, aula, dado);
        const pasta = pastaProjeto(req, aula, Boolean(dado.demonstracao));
        await projetos.prepararPasta(
          pasta,
          projetos.montarArquivos(
            aula,
            salvo.arquivos,
            Boolean(dado.demonstracao),
          ),
        );
        const retorno = await oficinas.comando(pasta, definicao);
        let arquivoGerado;
        if (aula.numero === 34) {
          try {
            arquivoGerado = await fs.readFile(
              path.join(pasta, ".data", "estado.json"),
              "utf8",
            );
          } catch (erro) {
            if (erro.code !== "ENOENT") {
              throw erro;
            }
          }
        }
        return json(res, 200, { ...retorno, arquivoGerado });
      }
      return json(res, 404, { erro: "Operação inexistente." });
    }
    atender().catch((erro) => {
      if (!res.headersSent && !res.destroyed) {
        json(res, 400, { erro: erro.message });
      }
    });
  });
  let porta = Number(process.env.LAB_PORT ?? 4321);
  let existente;
  await new Promise((resolve, reject) => {
    servidor.once("error", async (erro) => {
      if (erro.code !== "EADDRINUSE") {
        return reject(erro);
      }
      try {
        const resposta = await fetch(
          `http://127.0.0.1:${porta}/api/identidade`,
          {
            signal: AbortSignal.timeout(1000),
          },
        );
        const dado = await resposta.json();
        if (dado.identidade === identidade) {
          existente = `http://127.0.0.1:${porta}`;
          resolve();
          return;
        }
      } catch {}
      servidor.listen(0, "127.0.0.1", resolve);
    });
    servidor.listen(porta, "127.0.0.1", resolve);
  });
  const endereco = existente ?? `http://127.0.0.1:${servidor.address().port}`;
  if (!existente) {
    await fs.writeFile(
      caminhoInstancia,
      JSON.stringify({ endereco, pid: process.pid }),
      "utf8",
    );
  }
  console.log(
    JSON.stringify({ endereco, perfil: config.perfil, pid: process.pid }),
  );
  abrirNavegador(endereco);
  if (existente) {
    return;
  }
  async function encerrar() {
    for (const debug of depuracoes.values()) await debug.parar();
    depuracoes.clear();
    for (const id of [...ativos.keys()]) {
      await pararChave(id);
    }
    await gravacao;
    servidor.close(() => {
      process.exitCode = 0;
    });
    servidor.closeAllConnections();
  }
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

if (require.main === module) {
  iniciar().catch(async (erro) => {
    console.error(erro);
    try {
      await fs.mkdir(
        path.join(process.env.LAB_DATA_DIR ?? __dirname, ".dados"),
        {
          recursive: true,
        },
      );
      await fs.appendFile(
        path.join(process.env.LAB_DATA_DIR ?? __dirname, ".dados", "erro.log"),
        new Date().toISOString() + " " + erro.stack + "\n",
        "utf8",
      );
    } catch {}
    process.exitCode = 1;
  });
}

module.exports = { publico, validarAula };
