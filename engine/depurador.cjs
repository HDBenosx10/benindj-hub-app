"use strict";
const { fork } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const finais = new Set(["concluido", "parado", "erro"]);
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function valorRemoto(valor) {
  if (!valor) return "[indisponível]";
  if (valor.type === "undefined") return "undefined";
  if (valor.type === "function")
    return String(valor.description ?? "[função]")
      .split("\n")[0]
      .slice(0, 150);
  if (Object.hasOwn(valor, "value"))
    return typeof valor.value === "string"
      ? JSON.stringify(valor.value).slice(0, 1200)
      : String(valor.value);
  if (valor.preview?.properties?.length && valor.type === "object") {
    const campos = valor.preview.properties
      .map((p) => `${p.name}: ${p.value ?? p.type}`)
      .join(", ");
    return `${valor.description ?? "Object"} { ${campos}${valor.preview.overflow ? ", …" : ""} }`.slice(
      0,
      1200,
    );
  }
  return String(
    valor.unserializableValue ?? valor.description ?? valor.type,
  ).slice(0, 1200);
}
function validarConfiguracao(pontos = {}, observacoes = []) {
  if (
    !pontos ||
    Array.isArray(pontos) ||
    typeof pontos !== "object" ||
    Object.keys(pontos).length > 40
  )
    throw Error("Lista de breakpoints inválida.");
  for (const [arquivo, linhas] of Object.entries(pontos)) {
    if (
      !/^[a-zA-Z0-9_-]+\.(?:js|cjs)$/.test(arquivo) ||
      !Array.isArray(linhas) ||
      linhas.length > 100 ||
      linhas.some((l) => !Number.isInteger(l) || l < 1 || l > 100000)
    )
      throw Error("Breakpoint inválido.");
  }
  if (
    !Array.isArray(observacoes) ||
    observacoes.length > 20 ||
    observacoes.some(
      (o) => typeof o !== "string" || !o.trim() || o.length > 500,
    )
  )
    throw Error("Use até 20 expressões de observação, com até 500 caracteres.");
}

async function criarSessao(opcoes) {
  // O V8 usa o caminho físico completo. No Windows, TEMP pode conter
  // nomes 8.3 ou junctions, enquanto require resolve os módulos pelo nome longo.
  if (opcoes.pasta)
    opcoes = {
      ...opcoes,
      pasta: require("node:fs").realpathSync.native(opcoes.pasta),
    };
  validarConfiguracao(opcoes.breakpoints, opcoes.observacoes);
  const id = randomUUID();
  const arquivo = opcoes.arquivo ?? "atividade.js";
  const url = `hub-debug://${id}/${arquivo}`;
  const fontes = new Map();
  if (opcoes.pasta) {
    for (const nome of opcoes.arquivos)
      if (/\.(js|cjs)$/.test(nome))
        fontes.set(pathToFileURL(path.join(opcoes.pasta, nome)).href, {
          arquivo: nome,
          deslocamento: nome === arquivo ? 1 : 0,
        });
  } else fontes.set(url, { arquivo, deslocamento: 2 });
  const scripts = new Map();
  const pendentes = new Map();
  const pontos = new Map();
  let socket,
    sequencia = 0,
    pausa,
    quadroAtual = 0,
    timer,
    inatividade,
    geracao = 0,
    requisicaoAtiva;
  let observacoes = opcoes.observacoes ?? [],
    inspecao = Promise.resolve();
  const estado = {
    id,
    status: "iniciando",
    linha: null,
    arquivo,
    variaveis: [],
    observacoes: [],
    pilha: [],
    saida: [],
    erro: null,
    base: null,
    breakpoints: [],
  };
  const filho = fork(path.join(__dirname, "debug-worker.cjs"), [], {
    execArgv: [
      "--max-old-space-size=128",
      "--disable-warning=ExperimentalWarning",
    ],
    cwd: opcoes.pasta ?? __dirname,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  let fechou = false;
  const fechado = new Promise((resolve) =>
    filho.once("close", () => {
      fechou = true;
      resolve();
    }),
  );
  let encerramento;
  function parar(status = "parado", erro = null) {
    if (encerramento) return encerramento;
    encerramento = (async () => {
      if (!finais.has(estado.status)) {
        estado.status = status;
        estado.erro = erro;
        estado.linha = null;
        estado.variaveis = [];
        estado.pilha = [];
        pausa = null;
        geracao++;
      }
      clearTimeout(timer);
      clearTimeout(inatividade);
      requisicaoAtiva?.abort();
      for (const p of pendentes.values()) {
        clearTimeout(p.prazo);
        p.reject(Error("Sessão encerrada."));
      }
      pendentes.clear();
      let desconexao = Promise.resolve();
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        desconexao = new Promise((resolve) =>
          socket.addEventListener("close", resolve, { once: true }),
        );
        socket.close();
      }
      if (!fechou) filho.kill();
      await Promise.all([fechado, desconexao]);
    })();
    return encerramento;
  }
  function renovar() {
    clearTimeout(inatividade);
    inatividade = setTimeout(
      () =>
        void parar("parado", "Debug encerrado após 10 minutos sem interação."),
      600000,
    );
    inatividade.unref();
  }
  function emExecucao() {
    clearTimeout(timer);
    estado.status = "executando";
    estado.linha = null;
    estado.variaveis = [];
    estado.pilha = [];
    pausa = null;
    geracao++;
    // O tempo em pausa não consome o limite de execução.
    timer = setTimeout(
      () =>
        void parar(
          "erro",
          "Execução interrompida após 20 segundos sem pausa. Revise laços e Promises.",
        ),
      opcoes.prazoExecucao ?? 20000,
    );
    timer.unref();
  }
  function comando(metodo, parametros = {}) {
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      finais.has(estado.status)
    )
      return Promise.reject(Error("Sessão de debug encerrada."));
    return new Promise((resolve, reject) => {
      const numero = ++sequencia;
      const prazo = setTimeout(() => {
        pendentes.delete(numero);
        reject(Error("O debugger não respondeu."));
        void parar("erro", "O debugger não respondeu. Inicie outra sessão.");
      }, 4000);
      pendentes.set(numero, { resolve, reject, prazo });
      socket.send(
        JSON.stringify({ id: numero, method: metodo, params: parametros }),
      );
    });
  }
  function localizar(frame) {
    const fonte = scripts.get(frame.location.scriptId);
    return fonte
      ? {
          arquivo: fonte.arquivo,
          linha: frame.location.lineNumber + 1 - fonte.deslocamento,
          coluna: frame.location.columnNumber + 1,
        }
      : null;
  }
  async function inspecionar() {
    const versao = geracao;
    const frame = pausa?.[quadroAtual];
    if (!frame) return;
    const variaveis = [];
    for (const escopo of frame.scopeChain.filter((s) =>
      ["local", "block", "catch", "closure", "script"].includes(s.type),
    )) {
      const { result } = await comando("Runtime.getProperties", {
        objectId: escopo.object.objectId,
        ownProperties: true,
        generatePreview: true,
      });
      for (const item of result ?? []) {
        if (variaveis.length >= 100) break;
        if (
          [
            "console",
            "require",
            "recursos",
            "module",
            "exports",
            "__filename",
            "__dirname",
          ].includes(item.name) ||
          variaveis.some((v) => v.nome === item.name)
        )
          continue;
        variaveis.push({
          nome: item.name,
          valor: item.get ? "[getter: não executado]" : valorRemoto(item.value),
          escopo: escopo.type,
        });
      }
    }
    const resultados = [];
    for (const expressao of observacoes) {
      try {
        const r = await comando("Debugger.evaluateOnCallFrame", {
          callFrameId: frame.callFrameId,
          expression: expressao,
          silent: true,
          throwOnSideEffect: true,
          timeout: 250,
          generatePreview: true,
          objectGroup: "hub-observacoes",
        });
        resultados.push({
          expressao,
          valor: r.exceptionDetails
            ? String(
                r.exceptionDetails.exception?.description ??
                  r.exceptionDetails.text,
              ).split("\n")[0]
            : valorRemoto(r.result),
          erro: Boolean(r.exceptionDetails),
        });
      } catch (e) {
        resultados.push({
          expressao,
          valor: /terminated/i.test(e.message)
            ? "A expressão excedeu o limite de tempo."
            : e.message,
          erro: true,
        });
      }
    }
    if (geracao !== versao || estado.status !== "pausado") return;
    estado.variaveis = variaveis;
    estado.observacoes = resultados;
  }
  async function aoPausar(evento) {
    clearTimeout(timer);
    const frames = evento.callFrames.filter((f) => localizar(f));
    const primeiro = frames[0] && localizar(frames[0]);
    if (!primeiro || primeiro.linha < 1) {
      emExecucao();
      await comando(primeiro ? "Debugger.stepOver" : "Debugger.resume");
      return;
    }
    pausa = frames;
    quadroAtual = 0;
    geracao++;
    estado.status = "pausado";
    estado.erro =
      evento.reason === "exception" ? valorRemoto(evento.data) : null;
    Object.assign(estado, primeiro);
    estado.pilha = frames.map((f, indice) => ({
      indice,
      nome: f.functionName || "Programa",
      ...localizar(f),
    }));
    estado.motivo =
      evento.reason === "exception"
        ? "excecao"
        : evento.hitBreakpoints?.length
          ? "breakpoint"
          : "passo";
    estado.inspecionando = true;
    inspecao = inspecionar();
    try {
      await inspecao;
    } finally {
      estado.inspecionando = false;
    }
  }
  async function configurar(breakpoints = {}, novasObservacoes = observacoes) {
    await inspecao;
    validarConfiguracao(breakpoints, novasObservacoes);
    for (const ponto of pontos.keys())
      await comando("Debugger.removeBreakpoint", { breakpointId: ponto });
    pontos.clear();
    estado.breakpoints = [];
    for (const [fonteUrl, fonte] of fontes) {
      for (const linha of [...new Set(breakpoints[fonte.arquivo] ?? [])]) {
        const r = await comando("Debugger.setBreakpointByUrl", {
          url: fonteUrl,
          lineNumber: linha - 1 + fonte.deslocamento,
          columnNumber: 0,
        });
        const ponto = {
          arquivo: fonte.arquivo,
          linha,
          resolvida: r.locations?.length
            ? r.locations[0].lineNumber + 1 - fonte.deslocamento
            : null,
        };
        pontos.set(r.breakpointId, ponto);
        estado.breakpoints.push(ponto);
      }
    }
    observacoes = [...novasObservacoes];
    renovar();
    if (estado.status === "pausado") await inspecionar();
  }
  async function controlar(acao, indice) {
    renovar();
    if (acao === "parar") return parar();
    await inspecao;
    if (acao === "quadro") {
      if (
        estado.status !== "pausado" ||
        !Number.isInteger(indice) ||
        !pausa?.[indice]
      )
        throw Error("Quadro indisponível.");
      quadroAtual = indice;
      Object.assign(estado, localizar(pausa[indice]));
      await inspecionar();
      return;
    }
    if (acao === "pausar") {
      if (estado.status !== "executando")
        throw Error("O programa não está em execução.");
      await comando("Debugger.pause");
      return;
    }
    const metodo = {
      continuar: "Debugger.resume",
      proxima: "Debugger.stepOver",
      entrar: "Debugger.stepInto",
      sair: "Debugger.stepOut",
    }[acao];
    if (!metodo || estado.status !== "pausado")
      throw Error("Pause o programa antes de avançar.");
    await comando("Runtime.releaseObjectGroup", {
      objectGroup: "hub-observacoes",
    });
    emExecucao();
    await comando(metodo);
  }
  async function requisitar(dado) {
    if (!estado.base || finais.has(estado.status))
      throw Error("Continue até o servidor de debug ficar pronto.");
    if (requisicaoAtiva)
      throw Error("Aguarde a requisição atual ou pare o debug.");
    if (
      !dado ||
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(dado.metodo) ||
      typeof dado.caminho !== "string" ||
      !dado.caminho.startsWith("/") ||
      dado.caminho.startsWith("//") ||
      dado.caminho.length > 2000 ||
      typeof (dado.corpo ?? "") !== "string" ||
      (dado.corpo?.length ?? 0) > 100000
    )
      throw Error("Requisição inválida.");
    const destino = new URL(dado.caminho, estado.base);
    if (destino.origin !== estado.base)
      throw Error("Use um caminho do servidor de debug.");
    const controle = new AbortController();
    requisicaoAtiva = controle;
    const prazo = setTimeout(() => controle.abort(), 600000);
    prazo.unref();
    estado.httpResposta =
      "Aguardando resposta. Continue pelos breakpoints para concluir a requisição.";
    renovar();
    void (async () => {
      try {
        const resposta = await fetch(destino, {
          method: dado.metodo,
          headers: { "Content-Type": "application/json" },
          ...(dado.metodo === "GET" ? {} : { body: dado.corpo || undefined }),
          signal: controle.signal,
          redirect: "error",
        });
        const leitor = resposta.body?.getReader();
        let texto = "",
          bytes = 0;
        const decoder = new TextDecoder();
        while (leitor) {
          const parte = await leitor.read();
          if (parte.done) break;
          bytes += parte.value.length;
          texto += decoder.decode(parte.value, { stream: true });
          if (bytes >= 30000) {
            await leitor.cancel();
            texto += "\n[resposta truncada]";
            break;
          }
        }
        estado.httpResposta = "HTTP " + resposta.status + "\n" + texto;
      } catch (e) {
        estado.httpResposta = "Requisição encerrada: " + e.message;
      } finally {
        clearTimeout(prazo);
        requisicaoAtiva = null;
      }
    })();
  }
  const pronto = new Promise((resolve, reject) => {
    const prazo = setTimeout(
      () => reject(Error("O processo de debug não iniciou.")),
      6000,
    );
    filho.once("error", reject);
    filho.on("message", (m) => {
      if (m.tipo === "inspector") {
        clearTimeout(prazo);
        resolve(m.url);
      }
      if (m.tipo === "log" && estado.saida.length < 300)
        estado.saida.push(m.texto);
      if (m.tipo === "servidor") {
        estado.base = m.base;
        clearTimeout(timer);
      }
      if (m.tipo === "ocioso") clearTimeout(timer);
      if (m.tipo === "fim")
        void parar(m.erro ? "erro" : "concluido", m.erro ?? null);
    });
    filho.once("exit", () => {
      clearTimeout(prazo);
      reject(Error("Processo de debug encerrado."));
      if (!finais.has(estado.status))
        void parar("erro", "O programa encerrou a sessão.");
    });
  });
  try {
    filho.send({ tipo: "preparar", dados: { ...opcoes, url } });
    const endereco = await pronto;
    socket = new WebSocket(endereco);
    socket.addEventListener("message", (event) => {
      const m = JSON.parse(event.data);
      if (m.id) {
        const p = pendentes.get(m.id);
        if (!p) return;
        pendentes.delete(m.id);
        clearTimeout(p.prazo);
        if (m.error) p.reject(Error(m.error.message));
        else p.resolve(m.result ?? {});
      } else if (m.method === "Debugger.scriptParsed") {
        const fonte = fontes.get(m.params.url);
        if (fonte) scripts.set(m.params.scriptId, fonte);
      } else if (m.method === "Debugger.breakpointResolved") {
        const ponto = pontos.get(m.params.breakpointId);
        const fonte = scripts.get(m.params.location.scriptId);
        if (ponto && fonte)
          ponto.resolvida =
            m.params.location.lineNumber + 1 - fonte.deslocamento;
      } else if (m.method === "Debugger.paused") {
        void aoPausar(m.params).catch((e) => {
          if (!finais.has(estado.status)) void parar("erro", e.message);
        });
      }
    });
    socket.addEventListener("close", () => {
      if (!finais.has(estado.status))
        void parar("erro", "Conexão com o debugger encerrada.");
    });
    await Promise.race([
      once(socket, "open"),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(Error("Falha ao conectar ao debugger.")),
          5000,
        ).unref(),
      ),
    ]);
    await comando("Runtime.enable");
    await comando("Debugger.enable");
    await comando("Debugger.setPauseOnExceptions", { state: "uncaught" });
    const prefixo = opcoes.pasta
      ? pathToFileURL(opcoes.pasta + path.sep).href
      : `hub-debug://${id}/`;
    await comando("Debugger.setBlackboxPatterns", {
      patterns: ["^(?!" + escaparRegex(prefixo) + ")"],
    });
    await configurar(opcoes.breakpoints, observacoes);
    emExecucao();
    renovar();
    filho.send({ tipo: "executar" });
    return {
      id,
      estado: () => structuredClone(estado),
      configurar,
      controlar,
      parar,
      renovar,
      requisitar,
    };
  } catch (e) {
    await parar("erro", e.message);
    throw e;
  }
}
module.exports = { criarSessao, validarConfiguracao };
