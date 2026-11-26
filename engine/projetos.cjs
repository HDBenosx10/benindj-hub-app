"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { Worker } = require("./execucao-isolada.cjs");
const { inspect, isDeepStrictEqual } = require("node:util");

async function conferirEntrada(pasta) {
  const { spawn, execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const { once } = require("node:events");
  const reserva = require("node:net").createServer();
  reserva.listen(0, "127.0.0.1");
  await once(reserva, "listening");
  const porta = reserva.address().port;
  await new Promise((resolve) => reserva.close(resolve));
  const filho = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "iniciar.cjs"],
    {
      cwd: pasta,
      env: { ...process.env, PORT: String(porta), HOST: "127.0.0.1" },
      windowsHide: true,
    },
  );
  let saida = "";
  let erros = "";
  try {
    await new Promise((resolve, reject) => {
      const prazo = setTimeout(
        () =>
          reject(new Error("A entrada iniciar.cjs não ficou pronta. " + erros)),
        5000,
      );
      filho.stdout.on("data", (dados) => {
        saida += dados.toString("utf8");
        if (saida.includes("Loja em http://")) {
          clearTimeout(prazo);
          resolve();
        }
      });
      filho.stderr.on("data", (dados) => {
        erros += dados.toString("utf8");
      });
      filho.once("error", (erro) => {
        clearTimeout(prazo);
        reject(erro);
      });
      filho.once("exit", () => {
        clearTimeout(prazo);
        reject(new Error("Entrada encerrada antes de iniciar. " + erros));
      });
    });
    const resposta = await fetch(`http://127.0.0.1:${porta}/saude`, {
      signal: AbortSignal.timeout(2000),
    });
    const dado = await resposta.json();
    if (resposta.status !== 200 || dado.ok !== true) {
      throw new Error(
        "A entrada normal não atendeu a saúde na porta configurada.",
      );
    }
  } finally {
    if (filho.exitCode === null) {
      const fim = once(filho, "exit");
      filho.kill();
      await fim;
    }
  }
  let rejeitou = false;
  try {
    await promisify(execFile)(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", "iniciar.cjs"],
      {
        cwd: pasta,
        env: { ...process.env, PORT: "" },
        timeout: 4000,
        encoding: "utf8",
        windowsHide: true,
      },
    );
  } catch (erro) {
    rejeitou = erro.stderr?.includes("PORT inválida") ?? false;
  }
  if (!rejeitou) {
    throw new Error(
      "A entrada precisa rejeitar PORT vazia antes de aceitar requisições.",
    );
  }
  return "iniciar.cjs executou a API na porta configurada e recusou a configuração inválida.";
}

function confere(recebido, esperado) {
  if (Array.isArray(esperado)) {
    return (
      Array.isArray(recebido) &&
      recebido.length === esperado.length &&
      esperado.every((valor, indice) => confere(recebido[indice], valor))
    );
  }
  if (esperado !== null && typeof esperado === "object") {
    return (
      recebido !== null &&
      typeof recebido === "object" &&
      Object.entries(esperado).every(
        ([chave, valor]) =>
          Object.hasOwn(recebido, chave) && confere(recebido[chave], valor),
      )
    );
  }
  return isDeepStrictEqual(recebido, esperado);
}

function montarArquivos(aula, alteracoes = {}, demonstracao = false) {
  if (demonstracao) {
    return { ...aula.professor.solucaoProjeto };
  }
  return Object.fromEntries(
    aula.projeto.arquivos.map((arquivo) => [
      arquivo.nome,
      arquivo.editavel && typeof alteracoes[arquivo.nome] === "string"
        ? alteracoes[arquivo.nome]
        : arquivo.codigo,
    ]),
  );
}

async function prepararPasta(pasta, arquivos) {
  await fs.mkdir(pasta, { recursive: true });
  for (const [nome, codigo] of Object.entries(arquivos)) {
    if (!/^[a-z0-9-]+\.(cjs|js|sql|json)$/.test(nome)) {
      throw new Error("Nome de arquivo inválido.");
    }
    await fs.writeFile(path.join(pasta, nome), codigo, "utf8");
  }
}

async function abrirProjeto(pasta, arquivos, opcoes = {}) {
  await prepararPasta(pasta, arquivos);
  const ambienteProprio =
    !opcoes.conexao && opcoes.ambiente
      ? await require("./ambiente.cjs").abrirAmbiente(
          path.join(pasta, ".recursos"),
          opcoes.ambiente,
        )
      : null;
  const conexao = opcoes.conexao ?? ambienteProprio?.conexao;
  const bancoCompartilhado = conexao?.recursos.find(
    (r) => r.id === "banco" && r.tipo === "sqlite" && r.modo === "arquivo",
  );
  const banco = bancoCompartilhado
    ? await require("./recursos-cliente.cjs")
        .criarCliente(conexao)
        .sqlite("banco")
        .caminhoArquivo()
    : path.join(pasta, "hub.sqlite");
  const logs = [];
  const requisicoes = [];
  const pendentes = new Map();
  const worker = new Worker(path.join(__dirname, "projeto-worker.cjs"), {
    workerData: {
      pasta,
      banco,
      conexao,
    },
    execArgv: ["--disable-warning=ExperimentalWarning"],
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });

  let falha;
  const pronto = new Promise((resolve, reject) => {
    const prazo = setTimeout(
      () =>
        reject(
          new Error(
            "O projeto não iniciou em 6 segundos. Confira a função criarServidor e os erros de sintaxe.",
          ),
        ),
      6000,
    );
    worker.on("message", (mensagem) => {
      if (mensagem.tipo === "pronto") {
        clearTimeout(prazo);
        resolve(mensagem.base);
      }
      if (mensagem.tipo === "falha") {
        falha = mensagem.erro;
        clearTimeout(prazo);
        reject(new Error(mensagem.erro));
      }
    });
    worker.on("error", (erro) => {
      falha = erro.message;
      clearTimeout(prazo);
      reject(erro);
    });
    worker.on("exit", (codigo) => {
      clearTimeout(prazo);
      reject(
        new Error(
          falha ??
            `O projeto encerrou antes de ficar pronto (código ${codigo}).`,
        ),
      );
    });
  });
  worker.on("message", (mensagem) => {
    if (mensagem.tipo === "requisicao" && requisicoes.length < 300) {
      requisicoes.push({ metodo: mensagem.metodo, caminho: mensagem.caminho });
    }
    if (mensagem.tipo === "log" && logs.length < 300) {
      logs.push(mensagem.texto);
    }
    if (mensagem.tipo === "modulo") {
      const pendente = pendentes.get(mensagem.id);
      if (pendente) {
        pendentes.delete(mensagem.id);
        clearTimeout(pendente.prazo);
        if (mensagem.erro) {
          pendente.reject(new Error(mensagem.erro));
        } else {
          pendente.resolve(mensagem.valor);
        }
      }
    }
  });
  async function parar() {
    await ambienteProprio?.parar();
    if (worker.threadId === -1) {
      return;
    }
    await new Promise((resolve) => {
      const prazo = setTimeout(() => {
        worker.terminate().then(resolve);
      }, 1500);
      worker.once("exit", () => {
        clearTimeout(prazo);
        resolve();
      });
      worker.postMessage({ tipo: "parar" });
    });
    for (const pendente of pendentes.values()) {
      clearTimeout(pendente.prazo);
      pendente.reject(new Error("Projeto encerrado."));
    }
    pendentes.clear();
  }
  try {
    const base = await pronto;
    return {
      base,
      banco,
      logs,
      requisicoes,
      pasta,
      parar,
      operarRecurso(dado) {
        const conexao = opcoes.conexao ?? ambienteProprio?.conexao;
        if (!conexao)
          throw Error("Este projeto não tem recursos configurados.");
        return require("./recursos-cliente.cjs")
          .criarCliente(conexao)
          .operar(dado.recurso, dado.acao, dado);
      },
      modulo(arquivo, funcao, argumentos) {
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const prazo = setTimeout(() => {
            pendentes.delete(id);
            reject(new Error("A função do cliente não terminou."));
          }, 5000);
          pendentes.set(id, { resolve, reject, prazo });
          worker.postMessage({
            tipo: "modulo",
            id,
            arquivo,
            funcao,
            argumentos,
          });
        });
      },
    };
  } catch (erro) {
    await parar();
    throw erro;
  }
}

async function requisitar(projeto, acao, token) {
  if (
    typeof acao.caminho !== "string" ||
    !acao.caminho.startsWith("/") ||
    acao.caminho.startsWith("//")
  ) {
    throw new Error("Use um caminho da API local, como /produtos.");
  }
  const opcoes = {
    method: acao.metodo,
    headers: {},
    signal: AbortSignal.timeout(4000),
  };
  if (acao.autorizado && token) {
    opcoes.headers.Authorization = `Bearer ${token}`;
  }
  if (acao.tokenManual) {
    opcoes.headers.Authorization = `Bearer ${acao.tokenManual}`;
  }
  if (acao.corpo !== undefined || acao.bruto !== undefined) {
    opcoes.headers["Content-Type"] = acao.tipo ?? "application/json";
    opcoes.body = acao.bruto ?? JSON.stringify(acao.corpo);
  }
  const inicio = performance.now();
  const resposta = await fetch(projeto.base + acao.caminho, opcoes);
  const texto = await resposta.text();
  let json;
  try {
    json = texto === "" ? null : JSON.parse(texto);
  } catch {
    json = texto;
  }
  return {
    status: resposta.status,
    json,
    headers: Object.fromEntries(resposta.headers),
    duracaoMs: Math.round(performance.now() - inicio),
  };
}

function acessarBanco(caminho, acao) {
  const { DatabaseSync } = require("node:sqlite");
  const banco = new DatabaseSync(caminho);
  try {
    return acao(banco);
  } finally {
    banco.close();
  }
}

async function testarProjeto(aula, arquivos) {
  const resultados = [];
  for (const teste of aula.projeto.testes) {
    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-teste-"));
    let projeto;
    const trilha = [];
    const respostasObservadas = [];
    let esperado = "";
    try {
      projeto = await abrirProjeto(pasta, arquivos, {
        ambiente: aula.ambiente,
      });
      let token;
      const tokensNomeados = new Map();
      if (teste.cliente) {
        const cliente = teste.cliente;
        esperado =
          cliente.erroContem ?? inspect(cliente.esperado, { depth: 5 });
        if (cliente.erroContem) {
          let erroRecebido;
          try {
            await projeto.modulo("cliente.cjs", cliente.funcao, [
              projeto.base,
              ...(cliente.argumentos ?? []),
            ]);
          } catch (erro) {
            erroRecebido = erro.message;
          }
          if (!erroRecebido?.includes(cliente.erroContem)) {
            throw new Error(
              "O cliente deveria recusar o status HTTP de erro. Recebido: " +
                erroRecebido,
            );
          }
          trilha.push(erroRecebido);
        } else {
          const retorno = await projeto.modulo("cliente.cjs", cliente.funcao, [
            projeto.base,
            ...(cliente.argumentos ?? []),
          ]);
          trilha.push(inspect(retorno, { depth: 5 }));
          if (!confere(retorno, cliente.esperado)) {
            throw new Error("O cliente retornou dados diferentes do contrato.");
          }
        }
        await projeto.modulo(null, null, []);
        const metodoEsperado =
          cliente.funcao === "criarProduto" ? "POST" : "GET";
        if (
          !projeto.requisicoes.some(
            (item) =>
              item.metodo === metodoEsperado && item.caminho === "/produtos",
          )
        ) {
          throw new Error(
            "O cliente precisa enviar uma requisição real à API do projeto.",
          );
        }
        trilha.push(
          "Requisição recebida pela API: " + metodoEsperado + " /produtos.",
        );
      }
      for (const acao of teste.acoes ?? []) {
        if (acao.recurso) {
          const recebido = await projeto.operarRecurso(acao);
          esperado = inspect(acao.esperado, { depth: 5 });
          trilha.push(
            "Recurso " + acao.recurso + ": " + inspect(recebido, { depth: 5 }),
          );
          if (!confere(recebido, acao.esperado))
            throw Error("Estado do recurso diferente do contrato.");
          continue;
        }
        if (acao.reiniciar) {
          await projeto.parar();
          projeto = await abrirProjeto(pasta, arquivos, {
            ambiente: aula.ambiente,
          });
          trilha.push(
            "Servidor encerrado e reaberto usando o mesmo arquivo SQLite.",
          );
          continue;
        }
        if (acao.sql) {
          acessarBanco(projeto.banco, (banco) => banco.exec(acao.sql));
          trilha.push(
            "Condição de banco preparada para verificar a integridade.",
          );
          continue;
        }
        if (acao.paralelo) {
          const respostas = await Promise.all(
            acao.paralelo.map((item) =>
              requisitar(
                projeto,
                item,
                typeof item.autorizado === "string"
                  ? tokensNomeados.get(item.autorizado)
                  : token,
              ),
            ),
          );
          const statuses = respostas.map((item) => item.status).sort();
          esperado = inspect(acao.statuses);
          trilha.push("Respostas concorrentes: " + inspect(statuses));
          if (!isDeepStrictEqual(statuses, acao.statuses)) {
            throw new Error(
              "As vendas concorrentes não respeitaram o estoque.",
            );
          }
          continue;
        }
        esperado =
          `${acao.metodo} ${acao.caminho} deve responder ${acao.status}` +
          (acao.json !== undefined
            ? "\n" + inspect(acao.json, { depth: 5 })
            : "");
        const resposta = await requisitar(
          projeto,
          acao,
          typeof acao.autorizado === "string"
            ? tokensNomeados.get(acao.autorizado)
            : token,
        );
        respostasObservadas.push({
          metodo: acao.metodo,
          caminho: new URL(acao.caminho, "http://localhost").pathname,
          status: resposta.status,
        });
        trilha.push(
          `${acao.metodo} ${acao.caminho} → ${resposta.status}\n${inspect(resposta.json, { depth: 5 })}`,
        );
        if (resposta.status !== acao.status) {
          throw new Error("Status diferente do contrato.");
        }
        if (acao.json !== undefined && !confere(resposta.json, acao.json)) {
          throw new Error("O corpo da resposta não corresponde ao contrato.");
        }
        if (acao.token) {
          token = resposta.json?.token;
          if (
            typeof token !== "string" ||
            !/^[a-f0-9]{64}$/.test(token) ||
            resposta.json.expiraEm <= Date.now()
          ) {
            throw new Error("Sessão sem token válido e expiração futura.");
          }
          if (typeof acao.token === "string")
            tokensNomeados.set(acao.token, token);
        }
      }
      if (teste.banco) {
        const quantidade = acessarBanco(
          projeto.banco,
          (banco) =>
            banco
              .prepare(`SELECT COUNT(*) AS total FROM ${teste.banco.tabela}`)
              .get().total,
        );
        if (quantidade !== teste.banco.quantidade) {
          throw new Error("Quantidade inesperada de registros persistidos.");
        }
        trilha.push(
          `SQLite: ${quantidade} registro(s) em ${teste.banco.tabela}.`,
        );
      }
      if (teste.verificarSenhas) {
        const linhas = acessarBanco(projeto.banco, (banco) =>
          banco.prepare("SELECT salt, hash FROM usuarios ORDER BY id").all(),
        );
        if (
          linhas.length !== 2 ||
          linhas[0].salt === linhas[1].salt ||
          linhas.some((linha) => !/^[a-f0-9]{128}$/.test(linha.hash))
        ) {
          throw new Error(
            "Verifique salt independente e hash de 64 bytes em hexadecimal.",
          );
        }
        const derivar = require("node:util").promisify(crypto.scrypt);
        for (const linha of linhas) {
          if (!/^[a-f0-9]{32}$/.test(linha.salt))
            throw new Error("Salt deve representar 16 bytes em hexadecimal.");
          const esperado = await derivar(
            "hub-laboratorio-2026",
            linha.salt,
            64,
            { N: 16384, r: 8, p: 1 },
          );
          if (!crypto.timingSafeEqual(esperado, Buffer.from(linha.hash, "hex")))
            throw new Error(
              "O registro precisa corresponder à derivação scrypt com os parâmetros da aula.",
            );
        }
        const novo = await projeto.modulo("senhas.cjs", "criarRegistro", [
          "outra-senha-de-teste",
        ]);
        const nativo = await derivar("outra-senha-de-teste", novo.salt, 64, {
          N: 16384,
          r: 8,
          p: 1,
        });
        if (novo.hash !== nativo.toString("hex"))
          throw new Error(
            "CriarRegistro precisa derivar o argumento recebido, sem senha fixa.",
          );
        for (const [senha, registro, esperado] of [
          ["outra-senha-de-teste", novo, true],
          ["incorreta", novo, false],
          ["outra-senha-de-teste", { salt: novo.salt, hash: "00" }, false],
        ]) {
          if (
            (await projeto.modulo("senhas.cjs", "verificarSenha", [
              senha,
              registro,
            ])) !== esperado
          )
            throw new Error(
              "Confira senha correta, incorreta e hash de tamanho incompatível.",
            );
        }
        trilha.push(
          "Dois salts independentes e hashes derivados, sem senha em texto.",
        );
      }
      if (teste.verificarLogs) {
        await projeto.modulo(null, null, []);
        const logs = projeto.logs.filter((linha) => {
          try {
            return JSON.parse(linha).metodo;
          } catch {
            return false;
          }
        });
        if (
          logs.length < 2 ||
          logs.join("").includes("hub-laboratorio-2026") ||
          logs.join("").includes("nao-registrar") ||
          logs.some((linha) => JSON.parse(linha).caminho.includes("?"))
        ) {
          throw new Error(
            "Registre método, caminho sem query, status e duração, preservando os dados sensíveis.",
          );
        }
        const textoCompleto = projeto.logs.join("\n");
        if (
          [token, ...tokensNomeados.values()].some(
            (t) => t && textoCompleto.includes(t),
          )
        )
          throw new Error("Token de sessão não deve aparecer nos logs.");
        if (
          textoCompleto.includes("hub-laboratorio-2026") ||
          textoCompleto.includes("nao-registrar")
        )
          throw new Error(
            "Logs não devem registrar credenciais ou query sensível.",
          );
        const estruturados = logs.map((l) => JSON.parse(l));
        if (
          estruturados.length !== respostasObservadas.length ||
          estruturados.some((l, i) => {
            const r = respostasObservadas[i];
            return (
              !r ||
              l.metodo !== r.metodo ||
              l.caminho !== r.caminho ||
              l.status !== r.status ||
              !Number.isFinite(l.duracaoMs) ||
              l.duracaoMs < 0 ||
              Object.keys(l).sort().join(",") !==
                "caminho,duracaoMs,metodo,status"
            );
          })
        )
          throw new Error(
            "Cada log deve corresponder à resposta concluída, com método, pathname, status final e duração numérica não negativa.",
          );
        trilha.push(...logs);
      }
      if (teste.config) {
        const valida = await projeto.modulo("config.cjs", "lerConfiguracao", [
          { PORT: "4000" },
        ]);
        if (valida.porta !== 4000) {
          throw new Error("A porta não foi convertida corretamente.");
        }
        let rejeitou = false;
        try {
          await projeto.modulo("config.cjs", "lerConfiguracao", [{ PORT: "" }]);
        } catch {
          rejeitou = true;
        }
        if (!rejeitou) {
          throw new Error("A configuração vazia deveria ser rejeitada.");
        }
        trilha.push("Configuração válida aceita e porta vazia recusada.");
        if (teste.config.completa) {
          for (const [ambiente, esperado] of [
            [{}, { host: "127.0.0.1", porta: 3000 }],
            [
              { HOST: " localhost ", PORT: "1" },
              { host: "localhost", porta: 1 },
            ],
            [{ PORT: "65535" }, { host: "127.0.0.1", porta: 65535 }],
          ]) {
            const r = await projeto.modulo("config.cjs", "lerConfiguracao", [
              ambiente,
            ]);
            if (!isDeepStrictEqual(r, esperado))
              throw new Error(
                "Confira padrões, host limpo e limites inclusivos da porta.",
              );
          }
          for (const [ambiente, mensagem] of [
            [{ PORT: null }, "PORT inválida"],
            [{ PORT: "65536" }, "PORT inválida"],
            [{ PORT: "2x" }, "PORT inválida"],
            [{ PORT: "0" }, "PORT inválida"],
            [{ HOST: null }, "HOST inválido"],
            [{ HOST: " " }, "HOST inválido"],
            [{ HOST: 12 }, "HOST inválido"],
          ]) {
            let erro;
            try {
              await projeto.modulo("config.cjs", "lerConfiguracao", [ambiente]);
            } catch (e) {
              erro = e;
            }
            if (erro?.message !== mensagem)
              throw new Error(
                "Recuse informação inválida com diagnóstico do campo, sem usá-la como ausência.",
              );
          }
          trilha.push("Host, ausência, tipos e faixa completa conferidos.");
        }
        await projeto.parar();
        trilha.push(await conferirEntrada(pasta));
      }
      resultados.push({
        nome: teste.nome,
        passou: true,
        esperado: esperado || "Contrato do cenário completo",
        recebido: trilha.join("\n\n"),
        registros: projeto.logs,
      });
    } catch (erro) {
      resultados.push({
        nome: teste.nome,
        passou: false,
        esperado: esperado || "Projeto iniciando e atendendo o cenário",
        recebido:
          erro.message + (trilha.length ? "\n\n" + trilha.join("\n\n") : ""),
        registros: projeto?.logs ?? [],
      });
    } finally {
      if (projeto) {
        await projeto.parar();
      }
      const destino = path.resolve(pasta);
      const raiz = path.resolve(os.tmpdir()) + path.sep;
      if (
        !destino.startsWith(raiz) ||
        !path.basename(destino).startsWith("hub-teste-")
      ) {
        throw new Error("Pasta de teste inesperada.");
      }
      await fs.rm(destino, { recursive: true, force: true });
    }
  }
  return resultados;
}

async function executarCliente(
  projeto,
  { funcao = "consultarProdutos", produto, token } = {},
) {
  if (!["consultarProdutos", "criarProduto"].includes(funcao))
    throw new Error("Escolha consultarProdutos ou criarProduto.");
  if (
    funcao === "criarProduto" &&
    (produto === null || typeof produto !== "object" || Array.isArray(produto))
  )
    throw new Error(
      "Preencha o corpo JSON com o objeto do produto para executar criarProduto.",
    );
  const argumentos =
    funcao === "criarProduto"
      ? [projeto.base, produto, token]
      : [projeto.base, token];
  return projeto.modulo("cliente.cjs", funcao, argumentos);
}
module.exports = {
  executarCliente,
  montarArquivos,
  prepararPasta,
  abrirProjeto,
  testarProjeto,
  requisitar,
  acessarBanco,
  confere,
};
