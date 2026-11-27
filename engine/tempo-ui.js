"use strict";
window.hubTempo = (() => {
  let registros = [],
    pendentes = [],
    fila = Promise.resolve(),
    pausado = false,
    pronto = false,
    erroSalvar = false;
  const reservatorio = new Map();
  const chave = "hub-tempo-pendente";
  const diaLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date());
  const formatar = (ms) => {
    const segundos = Math.floor(ms / 1000),
      horas = Math.floor(segundos / 3600),
      minutos = Math.floor(segundos / 60) % 60;
    return horas
      ? `${horas}h ${String(minutos).padStart(2, "0")}min`
      : `${minutos}min ${String(segundos % 60).padStart(2, "0")}s`;
  };
  function registrar(evento) {
    const k = JSON.stringify([
      evento.aulaId,
      evento.atividadeId,
      evento.modo,
      evento.dia,
    ]);
    const atual = reservatorio.get(k);
    if (atual) atual.milisegundos += evento.milisegundos;
    else reservatorio.set(k, { ...evento });
  }
  const relogio = HubTempoAtivo.criar({ registrar });
  function contexto() {
    if (
      !pronto ||
      perfil !== "aluno" ||
      previa ||
      !aula ||
      document.body.dataset.rota !== "aula" ||
      document.querySelector("dialog[open]")
    )
      return null;
    const pratica = aba === "praticar" || aba === "ambiente";
    return {
      aulaId: aula.id,
      atividadeId: pratica
        ? ((aula.exercicios ?? aula.missoes)?.[
            aula.modo === "funcoes" ? exercicioAtual : missaoAtual
          ]?.id ?? null)
        : null,
      modo: pratica ? "pratica" : "leitura",
      dia: diaLocal(),
    };
  }
  function atualizarContexto() {
    relogio.contexto(contexto());
    relogio.limite(HubConforto.configuracao().inatividade);
    desenhar();
  }
  function totais() {
    return [...registros, ...pendentes, ...reservatorio.values()];
  }
  function desenhar() {
    if (!pronto) return;
    const total = totais()
      .filter((r) => r.dia === diaLocal())
      .reduce((s, r) => s + r.milisegundos, 0);
    const motivo = relogio.motivo();
    const c = contexto();
    const tempoContexto = c
      ? totais()
          .filter(
            (r) =>
              r.aulaId === c.aulaId &&
              (!c.atividadeId || r.atividadeId === c.atividadeId),
          )
          .reduce((s, r) => s + r.milisegundos, 0)
      : 0;
    $("tempo-resumo").textContent = c
      ? `⏱ ${c.atividadeId ? "Atividade" : "Aula"} ${formatar(tempoContexto)} · Hoje ${formatar(total)}`
      : `⏱ Hoje · ${formatar(total)}`;
    $("tempo-pausar").title = pausado
      ? "Retomar contagem de estudo"
      : motivo
        ? "Contagem pausada automaticamente"
        : "Pausar contagem de estudo";
    $("tempo-resumo").title =
      `${motivo ? "Contagem pausada" : "Contando " + (aba === "praticar" ? "prática" : "leitura")} · ${erroSalvar ? "Registros aguardando gravação; mantenha o aplicativo aberto." : "Ver tempo por aula, atividade e dia"}`;
    $("tempo-resumo").dataset.contando = String(!motivo);
    $("tempo-pausar").textContent = pausado ? "▶" : "Ⅱ";
    $("tempo-pausar").setAttribute(
      "aria-label",
      pausado ? "Retomar contagem de estudo" : "Pausar contagem de estudo",
    );
  }
  function guardarFila() {
    try {
      localStorage.setItem(chave, JSON.stringify(pendentes));
    } catch {}
  }
  function coletar() {
    relogio.atualizar();
    for (const [k, r] of reservatorio) {
      const ms = Math.floor(r.milisegundos);
      if (ms >= 1)
        pendentes.push({ ...r, id: crypto.randomUUID(), milisegundos: ms });
      reservatorio.delete(k);
    }
    guardarFila();
  }
  function salvar() {
    if (!pronto) return fila;
    coletar();
    const trabalho = fila.then(async () => {
      while (pendentes.length) {
        const lote = pendentes.slice(0, 100);
        const r = await api("/api/tempo", { eventos: lote });
        const ids = new Set(lote.map((e) => e.id));
        pendentes = pendentes.filter((e) => !ids.has(e.id));
        registros = r.registros;
        guardarFila();
      }
      erroSalvar = false;
      desenhar();
    });
    fila = trabalho.catch(() => {
      erroSalvar = true;
      desenhar();
    });
    return trabalho;
  }
  function abrirResumo() {
    relogio.atualizar();
    const { d } = HubConforto.dialogo("Minhas horas de estudo");
    elemento(
      d,
      "p",
      "Tempo de atividade no Hub. Conta leitura e prática com a janela em foco; pausa em segundo plano, em diálogos ou após o período sem interação definido em Conforto. Não mede atenção nem altera suas aprovações.",
    );
    const lista = totais(),
      hoje = diaLocal();
    const soma = (filtro) =>
      lista.filter(filtro).reduce((s, r) => s + r.milisegundos, 0);
    elemento(d, "h3", "Hoje · " + formatar(soma((r) => r.dia === hoje)));
    elemento(
      d,
      "p",
      `Leitura: ${formatar(soma((r) => r.dia === hoje && r.modo === "leitura"))} · Prática: ${formatar(soma((r) => r.dia === hoje && r.modo === "pratica"))}`,
    );
    const motivo = relogio.motivo();
    elemento(
      d,
      "p",
      pausado
        ? "Pausado por você."
        : motivo === "inatividade"
          ? "Pausado por falta de interação. Volte à aula para continuar."
          : "A contagem fica pausada enquanto este resumo estiver aberto.",
      "secondary",
    );
    const tabela = elemento(d, "table", undefined, "tabela-tempo");
    const cab = elemento(elemento(tabela, "thead"), "tr");
    ["Aula / atividade", "Leitura", "Prática", "Total"].forEach((t) =>
      elemento(cab, "th", t),
    );
    const corpo = elemento(tabela, "tbody");
    for (const id of [...new Set(lista.map((r) => r.aulaId))]) {
      const tr = elemento(corpo, "tr");
      elemento(
        tr,
        "th",
        bibliotecaCompleta.find((a) => a.id === id)?.titulo ?? id,
      );
      for (const modo of ["leitura", "pratica", null])
        elemento(
          tr,
          "td",
          formatar(soma((r) => r.aulaId === id && (!modo || r.modo === modo))),
        );
      for (const atividade of [
        ...new Set(
          lista
            .filter((r) => r.aulaId === id && r.atividadeId)
            .map((r) => r.atividadeId),
        ),
      ]) {
        const linha = elemento(corpo, "tr"),
          titulo =
            id === aula?.id
              ? (aula.exercicios ?? aula.missoes)?.find(
                  (e) => e.id === atividade,
                )?.titulo
              : null;
        const tituloRegistrado = lista.find(r => r.aulaId === id && r.atividadeId === atividade && r.atividadeTitulo)?.atividadeTitulo;
        elemento(linha, "td", "↳ " + (tituloRegistrado ?? titulo ?? atividade));
        elemento(linha, "td", "—");
        const ms = soma((r) => r.aulaId === id && r.atividadeId === atividade);
        elemento(linha, "td", formatar(ms));
        elemento(linha, "td", formatar(ms));
      }
    }
    if (!lista.length)
      elemento(
        d,
        "p",
        "Seu tempo aparecerá aqui quando você começar uma aula.",
      );
    const detalhes = elemento(d, "details");
    elemento(detalhes, "summary", "Ver por dia");
    for (const dia of [...new Set(lista.map((r) => r.dia))].sort().reverse())
      elemento(
        detalhes,
        "p",
        `${dia} · ${formatar(soma((r) => r.dia === dia))}`,
      );
    botao(d, "Exportar registro CSV", () => {
      const texto =
        "dia,aula,atividade,modo,segundos\n" +
        lista
          .map((r) =>
            [
              r.dia,
              r.aulaId,
              r.atividadeId ?? "",
              r.modo,
              Math.floor(r.milisegundos / 1000),
            ].join(","),
          )
          .join("\n");
      baixar(
        new Blob(["\uFEFF", texto], { type: "text/csv;charset=utf-8" }),
        "minhas-horas-de-estudo.csv",
      );
    });
    d.showModal();
    atualizarContexto();
  }
  $("tempo-resumo").onclick = abrirResumo;
  $("tempo-pausar").onclick = () => {
    pausado = !pausado;
    relogio.pausar(pausado);
    desenhar();
  };
  for (const evento of ["pointerdown", "keydown", "wheel", "touchstart"])
    window.addEventListener(evento, () => relogio.interagir(), {
      passive: true,
      capture: true,
    });
  const janela = () => {
    relogio.janela({ visivel: !document.hidden, foco: document.hasFocus() });
    desenhar();
  };
  window.addEventListener("focus", () => {
    janela();
    relogio.interagir();
  });
  window.addEventListener("blur", () => {
    janela();
    void salvar().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    janela();
    void salvar().catch(() => {});
  });
  window.addEventListener("hub-atividade", atualizarContexto);
  new MutationObserver(atualizarContexto).observe(document.body, {
    attributes: true,
    attributeFilter: ["data-rota", "data-aba"],
  });
  new MutationObserver(atualizarContexto).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  inicioCarregado
    .then(async () => {
      if (perfil !== "aluno" || previa) {
        $("tempo-resumo").hidden = true;
        $("tempo-pausar").hidden = true;
        return;
      }
      try {
        pendentes = JSON.parse(localStorage.getItem(chave)) ?? [];
      } catch {}
      const r = await api("/api/tempo");
      registros = r.registros;
      pronto = true;
      janela();
      atualizarContexto();
      setInterval(() => {
        relogio.atualizar();
        atualizarContexto();
      }, 1000);
      setInterval(() => void salvar().catch(() => {}), 15000);
    })
    .catch((e) =>
      aviso("Não foi possível iniciar o registro de horas: " + e.message, true),
    );
  return { salvar, atualizarContexto, formatar };
})();
