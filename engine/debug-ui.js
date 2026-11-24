"use strict";
// A interface recebe um retrato do processo; nunca avalia código do aluno no navegador.
window.HubDebug = function criarPainelDebug(opcoes) {
  const $ = (id) => document.getElementById(id);
  const finais = new Set(["concluido", "erro", "parado"]);
  let contexto,
    configuracao = { breakpoints: {}, observacoes: [] },
    estado,
    intervalo;
  let atarefado = false,
    consultando = false,
    configurando = Promise.resolve(),
    assinatura = "",
    versao = 0;
  const ativo = () => Boolean(estado && !finais.has(estado.status));
  function contextoAtual() {
    return opcoes.contexto();
  }
  function chave(c) {
    return c
      ? `hub-debug:${c.perfil}:${c.aulaId}:${c.exercicioId ?? "projeto"}`
      : null;
  }
  function guardar() {
    try {
      localStorage.setItem(chave(contexto), JSON.stringify(configuracao));
    } catch {}
  }
  function abrir() {
    $("debug-content").hidden = false;
    $("debug-panel").classList.add("aberto");
    $("debug-toggle").setAttribute("aria-expanded", "true");
    $("debug-toggle").title = "Recolher painel de debug";
    $("debug-toggle").querySelector(".debug-chevron").textContent = "›";
  }
  function item(lista, nome, valor, erro) {
    const li = document.createElement("li");
    const titulo = document.createElement("code");
    titulo.textContent = nome;
    li.append(titulo);
    if (valor !== undefined) {
      const detalhe = document.createElement("pre");
      detalhe.className = "debug-value";
      detalhe.textContent = valor;
      li.append(detalhe);
    }
    li.classList.toggle("erro", Boolean(erro));
    lista.append(li);
    return li;
  }
  function vazio(lista, texto) {
    if (!lista.children.length) item(lista, texto);
  }
  function remover(li, titulo, acao) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "×";
    b.title = titulo;
    b.setAttribute("aria-label", titulo);
    b.className = "debug-remove";
    b.onclick = () => agir(acao);
    li.append(b);
  }
  async function agir(acao) {
    try {
      await acao();
    } catch (e) {
      $("debug-error").hidden = false;
      $("debug-error").textContent = e.message;
    }
  }
  function desenharListas() {
    const watches = $("debug-watches");
    watches.replaceChildren();
    configuracao.observacoes.forEach((expr) => {
      const resultado =
        estado?.status === "pausado"
          ? estado.observacoes.find((r) => r.expressao === expr)
          : null;
      const li = item(
        watches,
        expr,
        resultado?.valor ?? "Aguardando pausa…",
        resultado?.erro,
      );
      remover(li, "Remover observação " + expr, () => {
        configuracao.observacoes = configuracao.observacoes.filter(
          (s) => s !== expr,
        );
        return atualizarConfiguracao();
      });
    });
    vazio(watches, "Adicione uma variável ou expressão acima.");
    const variaveis = $("debug-variables");
    variaveis.replaceChildren();
    for (const v of estado?.variaveis ?? []) item(variaveis, v.nome, v.valor);
    vazio(
      variaveis,
      estado?.status === "pausado"
        ? "Sem variáveis neste escopo."
        : "Pause para inspecionar as variáveis.",
    );
    const pontos = $("debug-breakpoints");
    pontos.replaceChildren();
    for (const [arquivo, linhas] of Object.entries(configuracao.breakpoints))
      for (const linha of linhas) {
        const resolvido = estado?.breakpoints.find(
          (p) => p.arquivo === arquivo && p.linha === linha,
        );
        const li = item(
          pontos,
          `${arquivo}:${linha}`,
          ativo()
            ? resolvido?.resolvida
              ? resolvido.resolvida === linha
                ? "Confirmado"
                : "Pausa na próxima instrução: linha " + resolvido.resolvida
              : "Pendente: o arquivo ainda não foi executado."
            : undefined,
        );
        remover(li, `Remover breakpoint ${arquivo}:${linha}`, () => {
          configuracao.breakpoints[arquivo] = linhas.filter((n) => n !== linha);
          return atualizarConfiguracao();
        });
      }
    vazio(pontos, "Marque uma linha na margem do editor.");
    const pilha = $("debug-stack");
    pilha.replaceChildren();
    for (const frame of estado?.pilha ?? []) {
      const li = item(pilha, frame.nome);
      const b = document.createElement("button");
      b.textContent = `${frame.arquivo}:${frame.linha}`;
      b.title = "Inspecionar este escopo";
      b.onclick = () => agir(() => controlar("quadro", frame.indice));
      li.append(b);
    }
    vazio(pilha, "A pilha aparece durante a pausa.");
  }
  function desenhar() {
    const c = contextoAtual();
    const emDebug = ativo();
    const pausado = estado?.status === "pausado";
    const labels = {
      iniciando: "Iniciando",
      executando: estado?.base ? "Servidor ativo" : "Executando",
      pausado: "Pausado",
      concluido: "Concluído",
      parado: "Encerrado",
      erro: "Erro",
    };
    $("debug-status").textContent = labels[estado?.status] ?? "Pronto";
    $("debug-start").disabled = atarefado || emDebug || !c?.habilitado;
    $("debug-start").hidden = emDebug;
    $("debug-start").textContent =
      estado && finais.has(estado.status) ? "↻ Depurar novamente" : "▶ Depurar";
    document.querySelectorAll("[data-debug]").forEach((b) => {
      b.disabled =
        atarefado ||
        (b.dataset.debug === "parar"
          ? !emDebug
          : estado?.inspecionando ||
            (b.dataset.debug === "pausar"
              ? estado?.status !== "executando"
              : !pausado));
    });
    $("debug-calls-section").hidden = !c?.funcoes;
    $("debug-http").hidden = !c?.http;
    $("debug-calls").readOnly = emDebug;
    $("debug-request").disabled = !estado?.base || !emDebug || atarefado;
    $("debug-error").hidden = !estado?.erro;
    $("debug-error").textContent = estado?.erro ?? "";
    if (estado?.httpResposta)
      $("debug-http-output").textContent = estado.httpResposta;
    if (pausado) {
      const chamadas = c?.funcoes && estado.linha > c.linhasCodigo + 2;
      $("debug-location").textContent = chamadas
        ? `Pausado nas chamadas para investigar, linha ${estado.linha - c.linhasCodigo - 2}. A próxima instrução ainda não foi executada.`
        : `${estado.arquivo}:${estado.linha} · ${estado.motivo === "breakpoint" ? "Breakpoint" : "Pausa"}. A próxima instrução ainda não foi executada.`;
    } else
      $("debug-location").textContent = !c?.habilitado
        ? "Depuração disponível em atividades JavaScript. Arquivos JSON e SQL não são executados pelo debugger."
        : estado?.status === "concluido"
          ? "Execução concluída. Ajuste suas entradas e depure novamente para investigar outro caminho."
          : "Clique à esquerda dos números de linha para marcar um breakpoint. A linha destacada será executada no próximo passo.";
    opcoes.editor.depurar(
      configuracao.breakpoints[c?.arquivo] ?? [],
      pausado && estado.arquivo === c?.arquivo ? estado.linha : null,
    );
    desenharListas();
  }
  async function aplicarEstado(novo) {
    estado = novo;
    const c = contextoAtual();
    if (novo.status === "pausado" && !c?.funcoes && novo.arquivo !== c?.arquivo)
      await opcoes.abrirArquivo(novo.arquivo);
    const texto = [
      ...novo.saida,
      ...(novo.erro ? [novo.erro] : []),
      ...(novo.status === "concluido"
        ? ["Debug concluído. Use Verificar para conferir os critérios."]
        : []),
    ].join("\n");
    if (texto) $("console-livre").textContent = texto;
    opcoes.bloquear(ativo());
    desenhar();
    if (finais.has(novo.status)) {
      clearInterval(intervalo);
      intervalo = null;
    }
  }
  async function consultar() {
    if (consultando || atarefado || !ativo()) return;
    consultando = true;
    const atual = versao;
    try {
      const novo = await opcoes.api("/api/debug/estado", {
        aulaId: contexto.aulaId,
        sessaoId: estado.id,
      });
      if (atual !== versao) return;
      const s = JSON.stringify(novo);
      if (s !== assinatura) {
        assinatura = s;
        await aplicarEstado(novo);
      }
    } catch (e) {
      if (atual === versao) {
        clearInterval(intervalo);
        intervalo = null;
        await aplicarEstado({
          ...estado,
          status: "erro",
          erro: e.message,
          linha: null,
          variaveis: [],
          pilha: [],
        });
      }
    } finally {
      consultando = false;
    }
  }
  async function controlar(acao, quadro) {
    if (!estado || atarefado) return;
    atarefado = true;
    desenhar();
    try {
      await configurando;
      const novo = await opcoes.api("/api/debug/controle", {
        aulaId: contexto.aulaId,
        sessaoId: estado.id,
        acao,
        quadro,
      });
      versao++;
      assinatura = "";
      await aplicarEstado(novo);
    } finally {
      atarefado = false;
      desenhar();
    }
  }
  function atualizarConfiguracao() {
    guardar();
    desenhar();
    if (!ativo()) return Promise.resolve();
    const id = estado.id,
      aulaId = contexto.aulaId;
    const dados = structuredClone(configuracao);
    configurando = configurando
      .catch(() => {})
      .then(async () => {
        if (estado?.id !== id || !ativo()) return;
        const novo = await opcoes.api("/api/debug/configurar", {
          aulaId,
          sessaoId: id,
          ...dados,
        });
        if (estado?.id === id) {
          versao++;
          assinatura = "";
          await aplicarEstado(novo);
        }
      });
    return configurando;
  }
  async function iniciar() {
    if (atarefado || ativo()) return;
    atarefado = true;
    abrir();
    $("debug-error").hidden = true;
    desenhar();
    try {
      await opcoes.salvar();
      const c = contextoAtual();
      const novo = await opcoes.api(
        "/api/debug/iniciar",
        opcoes.dados({
          exercicioId: c.exercicioId,
          arquivo: c.arquivo,
          chamadas: $("debug-calls").value,
          ...configuracao,
        }),
      );
      versao++;
      assinatura = "";
      await aplicarEstado(novo);
      intervalo = setInterval(() => void consultar(), 250);
    } finally {
      atarefado = false;
      desenhar();
    }
  }
  async function parar() {
    if (ativo()) await controlar("parar");
  }
  function contextoAtualizado() {
    const novo = contextoAtual();
    if (chave(novo) !== chave(contexto)) {
      clearInterval(intervalo);
      intervalo = null;
      versao++;
      const antigo = estado,
        aulaId = contexto?.aulaId;
      estado = null;
      if (antigo && !finais.has(antigo.status))
        void opcoes
          .api("/api/debug/controle", {
            aulaId,
            sessaoId: antigo.id,
            acao: "parar",
          })
          .catch(() => {});
      configuracao = { breakpoints: {}, observacoes: [] };
      try {
        const salvo = JSON.parse(localStorage.getItem(chave(novo)));
        if (
          salvo &&
          typeof salvo.breakpoints === "object" &&
          Array.isArray(salvo.observacoes)
        )
          configuracao = salvo;
      } catch {}
    }
    contexto = novo;
    if (!ativo()) $("debug-calls").value = $("rascunho").value;
    desenhar();
  }
  $("debug-toggle").onclick = () => {
    if ($("debug-content").hidden) abrir();
    else {
      $("debug-content").hidden = true;
      $("debug-panel").classList.remove("aberto");
      $("debug-toggle").setAttribute("aria-expanded", "false");
      $("debug-toggle").title = "Abrir painel de debug";
      $("debug-toggle").querySelector(".debug-chevron").textContent = "‹";
    }
  };
  $("debug-start").onclick = () => agir(iniciar);
  document
    .querySelectorAll("[data-debug]")
    .forEach((b) => (b.onclick = () => agir(() => controlar(b.dataset.debug))));
  $("debug-calls").oninput = () => {
    $("rascunho").value = $("debug-calls").value;
    $("rascunho").dispatchEvent(new Event("input"));
  };
  $("debug-watch-form").onsubmit = (e) => {
    e.preventDefault();
    void agir(async () => {
      const valor = $("debug-watch-input").value.trim();
      if (!valor || configuracao.observacoes.includes(valor)) return;
      if (configuracao.observacoes.length >= 20)
        throw Error("Use até 20 observações.");
      configuracao.observacoes.push(valor);
      $("debug-watch-input").value = "";
      await atualizarConfiguracao();
    });
  };
  $("debug-break-form").onsubmit = (e) => {
    e.preventDefault();
    void agir(async () => {
      const c = contextoAtual(),
        linha = Number($("debug-break-line").value);
      if (
        !c?.habilitado ||
        !Number.isInteger(linha) ||
        linha < 1 ||
        linha > c.linhasCodigo
      )
        throw Error(
          "Escolha uma linha existente no arquivo JavaScript aberto.",
        );
      configuracao.breakpoints[c.arquivo] = [
        ...new Set([...(configuracao.breakpoints[c.arquivo] ?? []), linha]),
      ].sort((a, b) => a - b);
      $("debug-break-line").value = "";
      await atualizarConfiguracao();
    });
  };
  $("debug-request").onclick = () =>
    agir(async () => {
      if (!ativo()) return;
      await aplicarEstado(
        await opcoes.api("/api/debug/requisitar", {
          aulaId: contexto.aulaId,
          sessaoId: estado.id,
          requisicao: {
            metodo: $("debug-method").value,
            caminho: $("debug-path").value,
            corpo: $("debug-body").value,
          },
        }),
      );
    });
  document.addEventListener(
    "keydown",
    (e) => {
      if (!ativo() || e.ctrlKey || e.altKey || e.metaKey) return;
      const acao =
        e.key === "F8"
          ? estado.status === "pausado"
            ? "continuar"
            : "pausar"
          : e.key === "F10"
            ? "proxima"
            : e.key === "F11"
              ? e.shiftKey
                ? "sair"
                : "entrar"
              : null;
      if (acao) {
        e.preventDefault();
        void agir(() => controlar(acao));
      }
    },
    true,
  );
  return {
    ativo,
    parar,
    contextoAtualizado,
    breakpoints(linhas, automatico = false) {
      const c = contextoAtual();
      if (!c?.habilitado) return;
      if (!automatico) abrir();
      configuracao.breakpoints[c.arquivo] = linhas;
      void agir(atualizarConfiguracao);
    },
  };
};
