"use strict";
window.HubConforto = (() => {
  let iniciado = false,
    ultimoSalvo = "",
    enviando = Promise.resolve(),
    restaurando = false;
  const padrao = {
    codigo: 15,
    leitura: 16,
    ligaturas: true,
    quebra: true,
    foco: true,
    contraste: false,
    divisao: 36,
    resultados: 40,
    inatividade: 300000,
  };
  let config = { ...padrao };
  const origemAmbiente = document.createComment(
    "Posição do ambiente fora da prática",
  );
  $("ambiente").before(origemAmbiente);
  function posicionarAmbiente(nome, aberto = false) {
    if (nome === "praticar" && aberto)
      document.querySelector(".bancada-codigo").append($("ambiente"));
    else if (nome !== "praticar") origemAmbiente.after($("ambiente"));
  }
  const ler = (chave, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(chave)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {}
  };
  function preferencias() {
    const valores = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        /^(hub-conforto$|hub-tempo-pendente$|hub-layout:|hub-editor-posicao:|hub-debug:)/.test(
          k,
        )
      )
        valores[k] = localStorage.getItem(k);
    }
    return valores;
  }
  async function salvarPreferencias() {
    guardarLayout();
    editorCodigo.guardarPosicao();
    const valores = preferencias(),
      texto = JSON.stringify(valores);
    if (texto === ultimoSalvo || !iniciado) return;
    const trabalho = enviando
      .then(() => api("/api/preferencias", { valores }))
      .then(() => {
        ultimoSalvo = texto;
      });
    enviando = trabalho.catch(() => {});
    return trabalho;
  }
  function aplicar() {
    const estilo = document.documentElement.style;
    estilo.setProperty("--tamanho-codigo", `${config.codigo}px`);
    estilo.setProperty("--tamanho-leitura", `${config.leitura}px`);
    estilo.setProperty("--largura-leitura", `${config.divisao}%`);
    estilo.setProperty("--altura-resultados", `${config.resultados}%`);
    estilo.setProperty(
      "--ligaturas-codigo",
      config.ligaturas ? "contextual" : "none",
    );
    estilo.setProperty(
      "--recursos-fonte",
      config.ligaturas ? '"calt" 1, "liga" 1' : '"calt" 0, "liga" 0',
    );
    document.body.dataset.concentracao = String(config.foco);
    document.body.dataset.contraste = String(config.contraste);
    editorCodigo.configurar({ quebrarLinhas: config.quebra });
    gravar("hub-conforto", config);
  }
  function dialogo(titulo) {
    const origem = document.activeElement;
    const d = elemento(document.body, "dialog", undefined, "conforto-dialog");
    const topo = elemento(d, "div", undefined, "dialog-heading");
    const h = elemento(topo, "h2", titulo);
    h.id = "dialogo-conforto-titulo";
    d.setAttribute("aria-labelledby", h.id);
    const fechar = () => {
      d.close();
      d.remove();
      if (origem?.isConnected) origem.focus();
    };
    botao(topo, "✕", fechar).setAttribute("aria-label", "Fechar " + titulo);
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      fechar();
    });
    return { d, fechar };
  }
  function abrirPreferencias() {
    const { d } = dialogo("Seu conforto de estudo");
    elemento(
      d,
      "p",
      "Fira Code com Dracula Pro. Estas preferências ficam salvas neste perfil.",
    );
    const campo = (titulo, chave, opcoes) => {
      const label = elemento(d, "label", titulo, "campo");
      const select = elemento(label, "select");
      for (const [valor, texto] of opcoes) {
        const o = elemento(select, "option", texto);
        o.value = valor;
        o.selected = String(valor) === String(config[chave]);
      }
      select.onchange = () => {
        config[chave] = Number(select.value);
        aplicar();
      };
    };
    campo(
      "Tamanho do código",
      "codigo",
      [13, 14, 15, 16, 18, 20, 22, 24].map((n) => [n, n + " px"]),
    );
    campo(
      "Tamanho da leitura",
      "leitura",
      [14, 15, 16, 18, 20, 22].map((n) => [n, n + " px"]),
    );
    campo(
      "Espaço para console e resultados",
      "resultados",
      [25, 35, 40, 45, 55].map((n) => [n, n + "% da área de prática"]),
    );
    campo("Pausar tempo após ficar sem interação por", "inatividade", [
      [120000, "2 minutos"],
      [300000, "5 minutos"],
      [600000, "10 minutos"],
    ]);
    for (const [chave, texto] of [
      ["ligaturas", "Ligaturas da Fira Code (===, =>, !=)"],
      ["quebra", "Quebrar linhas longas do código"],
      ["foco", "Navegação compacta durante a prática"],
      ["contraste", "Mais contraste nos textos de apoio"],
    ]) {
      const l = elemento(d, "label", undefined, "preferencia-check"),
        c = elemento(l, "input");
      c.type = "checkbox";
      c.checked = config[chave];
      elemento(l, "span", texto);
      c.onchange = () => {
        config[chave] = c.checked;
        aplicar();
      };
    }
    elemento(
      d,
      "p",
      "Atalhos: Ctrl/Cmd+Enter verifica; Shift+Alt+F formata; Tab indenta; Escape e depois Tab sai do editor. F10 avança uma linha durante o debug.",
      "secondary",
    );
    d.addEventListener(
      "close",
      () => void salvarPreferencias().catch((e) => aviso(e.message, true)),
    );
    d.showModal();
  }
  function guardarLayout() {
    if (!aula || restaurando) return;
    const chave = "hub-layout:" + aula.id,
      atual = ler(chave, {});
    gravar(chave, {
      ...atual,
      leituraAberta: !$("leitura-conteudo").hidden,
      leituraY: $("briefing").scrollTop,
      ...(aba === "estudar" && document.body.dataset.rota === "aula"
        ? { estudoY: scrollY }
        : {}),
    });
  }
  function restaurarLayout(anterior) {
    if (!aula) return;
    const estado = anterior ?? ler("hub-layout:" + aula.id, null);
    if (!estado) return;
    restaurando = true;
    configurarLeitura(estado.leituraAberta !== false);
    const id = aula.id;
    requestAnimationFrame(() => {
      if (aula?.id === id) {
        $("briefing").scrollTop = estado.leituraY || 0;
        if (aba === "estudar") window.scrollTo(0, estado.estudoY || 0);
      }
      restaurando = false;
    });
  }
  function estadoAtividade(id) {
    const p = biblioteca.find((a) => a.id === aula?.id)?.progresso;
    return p?.aprovadas?.includes(id)
      ? "✓"
      : p?.revalidacoes?.includes(id)
        ? "↻"
        : resultados.some((r) => r.exercicioId === id)
          ? "◐"
          : "○";
  }
  async function selecionar(indice) {
    if (ocupado) return;
    await painelDebug.parar();
    await salvar();
    if (aula.modo === "funcoes") exercicioAtual = indice;
    else missaoAtual = indice;
    renderizarPratica();
    await registrarPosicao();
  }
  function atualizarNavegacao() {
    if (!aula || !$("navegacao-questoes")) return;
    const raiz = $("navegacao-questoes");
    raiz.replaceChildren();
    const atividades = aula.modo === "funcoes" ? aula.exercicios ?? [] : aula.missoes ?? [],
      indice = aula.modo === "funcoes" ? exercicioAtual : missaoAtual;
    const atividade = atividades[indice];
    if (!atividade) return;
    const anterior = botao(raiz, "←", () => selecionar(indice - 1));
    anterior.disabled = indice === 0 || ocupado;
    anterior.setAttribute("aria-label", "Atividade anterior");
    botao(
      raiz,
      `${indice + 1}/${atividades.length} · Ver atividades`,
      abrirQuestoes,
    );
    const proxima = botao(raiz, "→", () => selecionar(indice + 1));
    proxima.disabled = indice === atividades.length - 1 || ocupado;
    proxima.setAttribute("aria-label", "Próxima atividade");
    const referencia = botao(
      raiz,
      "Copiar referência",
      async () => {
        await navigator.clipboard.writeText(
          `${aula.id}/${atividade.id} — ${atividade.titulo}`,
        );
        aviso("Referência copiada.");
      },
      "text-button",
    );
    referencia.title = `${aula.id}/${atividade.id}`;
    botao(raiz, "Minhas tentativas", abrirHistorico, "text-button");
    botao(raiz, "Pedir ajuda", copiarDuvida, "text-button");
    if (perfil === "professor")
      botao(
        raiz,
        "Parecer e edição",
        () => window.HubRevisao.abrir(aula.id, atividade.id, "parecer"),
        "text-button",
      );
    const p = biblioteca.find((a) => a.id === aula.id)?.progresso;
    elemento(
      raiz,
      "span",
      aula.modo === "projeto"
        ? `${p?.completa ? "✓ Projeto validado" : "Projeto em andamento"} · ${atividades.filter((e) => respostas.experimentos?.[e.id] === "observado").length}/${atividades.length} observações`
        : `${p?.concluidos ?? 0}/${p?.total ?? atividades.length} questões concluídas`,
      "secondary",
    );
    document.querySelectorAll("#exercicios select option").forEach((o, i) => {
      o.textContent = `${estadoAtividade(atividades[i].id)} ${i + 1} de ${atividades.length} · ${atividades[i].titulo}`;
    });
  }
  function abrirQuestoes() {
    const { d, fechar } = dialogo("Atividades desta aula");
    elemento(
      d,
      "p",
      "✓ Aprovada · ◐ Tentativa em andamento · ↻ Verificar novamente · ○ Ainda não verificada",
      "secondary",
    );
    (aula.modo === "funcoes" ? aula.exercicios ?? [] : aula.missoes ?? []).forEach((e, i) => {
      const estado =
        aula.modo === "projeto"
          ? respostas.experimentos?.[e.id] === "observado"
            ? "✓ Observação registrada"
            : "○ Observação pendente"
          : estadoAtividade(e.id);
      botao(
        d,
        `${estado} · ${i + 1}. ${e.titulo}`,
        async () => {
          fechar();
          await selecionar(i);
        },
        "questao-linha",
      );
    });
    d.showModal();
  }
  function sincronizarEntradas() {
    const raiz = $("entradas-parametros");
    raiz.replaceChildren();
    if (aula?.modo !== "funcoes") return;
    const e = aula.exercicios[exercicioAtual],
      contrato = HubConteudo.contrato(e);
    const chamada = HubEditor.argumentosChamada(
      contrato.exemplos[0]?.chamada ?? "",
    );
    if (!chamada || chamada.argumentos.length !== contrato.parametros.length)
      return;
    elemento(raiz, "p", "Experimente com outras entradas", "entrada-titulo");
    const campos = contrato.parametros.map((p, i) => {
      const l = elemento(raiz, "label", p.nome, "entrada-parametro"),
        campo = elemento(l, "input");
      campo.value = chamada.argumentos[i];
      campo.spellcheck = false;
      campo.setAttribute("aria-label", "Entrada do parâmetro " + p.nome);
      return campo;
    });
    elemento(
      raiz,
      "small",
      'Use valores JavaScript: "texto", 12, null, undefined ou [1, 2].',
    );
    botao(raiz, "Executar com estas entradas", async () => {
      $("rascunho").value =
        `console.log(${aula.numero >= 31 ? "await " : ""}${chamada.funcao}(${campos.map((c) => c.value.trim() || "undefined").join(", ")}));`;
      $("modo-experimento").value = "desafio";
      $("rascunho").dispatchEvent(new Event("input"));
      focarPratica("execucao");
      await $("run-livre").onclick();
    });
  }
  function entradasDoTeste(raiz, teste) {
    if (aula.modo !== "funcoes" || teste.tecnica) {
      if (teste.tecnica)
        elemento(
          raiz,
          "p",
          "Esta verificação confere a técnica exigida, além dos resultados de comportamento.",
        );
      return;
    }
    const contrato = HubConteudo.contrato(aula.exercicios[exercicioAtual]);
    const nome = contrato.assinaturas[0]?.match(/^[\w$]+/)?.[0];
    const chamadas = HubEditor.chamadasDeTeste(teste.executar ?? "", nome);
    if (!chamadas.length) return;
    elemento(raiz, "strong", "Entrada · chamadas deste cenário");
    elemento(raiz, "pre", chamadas.join("\n"), "code");
    const usar = () => {
      $("rascunho").value = chamadas
        .map((c) => `console.log(${aula.numero >= 31 ? "await " : ""}${c});`)
        .join("\n");
      $("modo-experimento").value = "desafio";
      $("rascunho").dispatchEvent(new Event("input"));
      $("meus-experimentos").open = true;
    };
    botao(raiz, "Experimentar estas entradas", () => {
      usar();
      focarPratica("execucao");
      $("rascunho").focus();
    });
    botao(raiz, "Investigar no debugger", () => {
      usar();
      focarPratica("codigo");
      if ($("debug-content").hidden) $("debug-toggle").click();
      $("debug-calls").value = $("rascunho").value;
      $("debug-start").focus();
    });
  }
  async function abrirHistorico() {
    await salvar();
    const { historico } = await api(
      "/api/historico?aula=" + encodeURIComponent(aula.id),
    );
    const { d, fechar } = dialogo("Minhas tentativas");
    elemento(
      d,
      "p",
      "As verificações e restaurações criam cópias locais. Recuperar código não aprova critérios que mudaram.",
    );
    const atual = aula.exercicios?.[exercicioAtual]?.id;
    const visiveis = historico.filter(
      (h) => !h.atividadeId || h.atividadeId === atual,
    );
    if (!visiveis.length)
      elemento(
        d,
        "p",
        "Suas tentativas aparecerão aqui depois da primeira verificação.",
      );
    for (const h of visiveis) {
      const linha = elemento(d, "section", undefined, "tentativa-linha");
      elemento(
        linha,
        "strong",
        `${h.aprovada ? "✓ Aprovada naquela verificação" : h.motivo} · ${new Date(h.em).toLocaleString("pt-BR")}`,
      );
      botao(linha, "Comparar / recuperar", async () => {
        const r = await api("/api/historico", { aulaId: aula.id, id: h.id });
        const versao = r.historico.find((v) => v.id === h.id);
        const conteudo = versao?.conteudo;
        if (!conteudo) throw Error("Tentativa indisponível.");
        const anterior =
          conteudo.codigos?.[atual] ?? conteudo.arquivos?.[arquivoAtual];
        const detalhes = elemento(linha, "details");
        detalhes.open = true;
        elemento(detalhes, "summary", "Comparar as tentativas");
        const comparacao = elemento(
          detalhes,
          "div",
          undefined,
          "comparacao-codigo",
        );
        const codigoAtual = elemento(comparacao, "section");
        elemento(codigoAtual, "h3", "Código atual");
        elemento(codigoAtual, "pre", editorCodigo.value, "code");
        const guardada = elemento(comparacao, "section");
        elemento(guardada, "h3", "Tentativa guardada");
        elemento(
          guardada,
          "pre",
          anterior ?? JSON.stringify(conteudo, null, 2),
          "code",
        );
        elemento(
          detalhes,
          "p",
          "Compare com seu código atual. Recuperar substitui apenas os arquivos ou a questão guardados nesta tentativa.",
        );
        botao(detalhes, "Recuperar esta tentativa", async () => {
          await api("/api/historico/guardar", comDados({ exercicioId: atual }));
          Object.assign(respostas.codigos, conteudo.codigos ?? {});
          Object.assign(respostas.arquivos, conteudo.arquivos ?? {});
          renderizarEditor();
          editorCodigo.notificarAlteracao();
          await salvar();
          resultados = [];
          renderizarTestes();
          fechar();
        });
      });
    }
    d.showModal();
  }
  async function copiarDuvida() {
    await salvar();
    const atividade = (aula.exercicios ?? aula.missoes)[
      aula.modo === "funcoes" ? exercicioAtual : missaoAtual
    ];
    const falhas = resultados.filter(
      (r) => !r.passou && (!r.exercicioId || r.exercicioId === atividade.id),
    );
    const texto = `${aula.id}/${atividade.id} — ${atividade.titulo}\n\nMinha dúvida: \n\nMinha tentativa:\n${editorCodigo.value}\n\nResultados a investigar:\n${falhas.map((r) => `${r.nome}: esperado ${r.esperado}; recebido ${r.recebido}`).join("\n")}`;
    const { d } = dialogo("Levar minha dúvida ao professor");
    elemento(
      d,
      "p",
      "Revise e escreva o que tentou entender. O aplicativo não envia mensagens automaticamente.",
    );
    const campo = elemento(d, "textarea");
    campo.value = texto;
    campo.rows = 12;
    botao(d, "Copiar contexto da dúvida", async () => {
      await navigator.clipboard.writeText(campo.value);
      aviso("Contexto copiado para compartilhar com o professor.");
    });
    d.showModal();
  }
  function mostrarConquista() {
    atualizarNavegacao();
    const p = $("navegacao-questoes");
    p.classList.add("questao-concluida");
    setTimeout(() => p.classList.remove("questao-concluida"), 2500);
  }
  function aoAbrirEditor() {
    aplicar();
    sincronizarEntradas();
    atualizarNavegacao();
    const dados = $("dados-desafio");
    const primeiroExemplo = [
      ...dados.querySelectorAll(":scope > details"),
    ].find((d) => d.querySelector("summary")?.textContent === "Exemplo 1");
    if (primeiroExemplo) {
      const assinatura = dados.querySelector(":scope > pre");
      if (assinatura) assinatura.after(primeiroExemplo);
      else dados.prepend(primeiroExemplo);
    }
    const ajudas = [...dados.querySelectorAll(".ajuda-contrato")];
    if (ajudas.length) {
      const ajuda = elemento(dados, "details");
      elemento(ajuda, "summary", "Como ler a assinatura e os parâmetros");
      ajudas.forEach((p) => ajuda.append(p));
    }
    const pistas = [...$("pistas-desafio").querySelectorAll(":scope > p")];
    if (pistas.length > 1) {
      let reveladas = 1;
      pistas.forEach((p, i) => {
        p.hidden = i > 0;
      });
      const proxima = botao(
        $("pistas-desafio"),
        "Mostrar próxima pista",
        () => {
          pistas[reveladas++].hidden = false;
          proxima.hidden = reveladas === pistas.length;
        },
      );
    }
    const voltar = $("voltar-conceito");
    voltar.onclick = () => {
      const { d, fechar } = dialogo("Rever um conceito desta aula");
      elemento(
        d,
        "p",
        "Escolha o assunto que quer retomar. Sua questão e sua tentativa ficam guardadas.",
      );
      [...$("estudar").querySelectorAll(".conceito-aula")].forEach((secao) =>
        botao(
          d,
          secao.querySelector("h3").textContent,
          () => {
            fechar();
            mostrarAba("estudar");
            $("estudar").querySelector("details.texto-aula").open = true;
            secao.scrollIntoView({ block: "start" });
          },
          "questao-linha",
        ),
      );
      d.showModal();
    };
    if (!$("voltar-questao-estudo")) {
      const voltarQuestao = botao(
        $("estudar"),
        "Voltar à minha questão →",
        () => mostrarAba("praticar"),
        "primary voltar-questao-estudo",
      );
      voltarQuestao.id = "voltar-questao-estudo";
    }
    document
      .querySelectorAll("#nav-recursos button, .hub-nav button")
      .forEach((b) => {
        b.title = b.textContent.trim();
      });
    window.dispatchEvent(new Event("hub-atividade"));
  }
  $("preferencias-editor").onclick = abrirPreferencias;
  const divisor = elemento(
    document.querySelector(".bancada"),
    "div",
    undefined,
    "divisor-paineis",
  );
  document
    .querySelector(".bancada")
    .insertBefore(divisor, document.querySelector(".bancada-codigo"));
  divisor.tabIndex = 0;
  divisor.setAttribute("role", "separator");
  divisor.setAttribute("aria-orientation", "vertical");
  divisor.setAttribute("aria-label", "Ajustar largura do enunciado");
  const dividir = (valor) => {
    config.divisao = Math.max(28, Math.min(55, valor));
    divisor.setAttribute("aria-valuenow", Math.round(config.divisao));
    aplicar();
  };
  divisor.setAttribute("aria-valuemin", "28");
  divisor.setAttribute("aria-valuemax", "55");
  divisor.setAttribute("aria-valuenow", String(config.divisao));
  divisor.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      dividir(config.divisao + (e.key === "ArrowLeft" ? -2 : 2));
    }
  };
  divisor.onpointerdown = (e) => {
    e.preventDefault();
    divisor.setPointerCapture(e.pointerId);
  };
  divisor.onpointermove = (e) => {
    if (divisor.hasPointerCapture(e.pointerId)) {
      const r = divisor.parentElement.getBoundingClientRect();
      dividir(((e.clientX - r.left) / r.width) * 100);
    }
  };
  const observarRolagem = () => guardarLayout();
  window.addEventListener("scroll", observarRolagem, { passive: true });
  $("briefing").addEventListener("scroll", observarRolagem, { passive: true });
  setInterval(() => {
    if (iniciado) void salvarPreferencias().catch(() => {});
  }, 5000);
  return {
    iniciar(valores = {}) {
      if (iniciado) return;
      for (const [k, v] of Object.entries(valores))
        if (typeof v === "string")
          try {
            localStorage.setItem(k, v);
          } catch {}
      config = { ...padrao, ...ler("hub-conforto", {}) };
      config.codigo = Math.min(24, Math.max(12, Number(config.codigo) || 15));
      config.leitura = Math.min(22, Math.max(14, Number(config.leitura) || 16));
      config.divisao = Math.min(55, Math.max(28, Number(config.divisao) || 36));
      iniciado = true;
      aplicar();
    },
    salvar: salvarPreferencias,
    guardarLayout,
    restaurarLayout,
    lerLayout: (id) => ler("hub-layout:" + id, null),
    estadoAtividade,
    atualizarNavegacao,
    aoAbrirEditor,
    sincronizarEntradas,
    entradasDoTeste,
    mostrarConquista,
    dialogo,
    posicionarAmbiente,
    configuracao: () => config,
  };
})();
