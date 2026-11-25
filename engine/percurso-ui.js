"use strict";
let filaEstudo = Promise.resolve();
const nomesObjetivos = {
  backend: "Back-end",
  frontend: "Front-end",
  ia: "Inteligência artificial",
  outro: "Outro objetivo",
};
function estadoDaAula(a) {
  if (a.disponivel === false) return "Aguardando liberação do professor";
  return a.progresso?.completa
    ? "Concluída"
    : a.estudo?.iniciada || a.progresso?.concluidos > 0
      ? "Em andamento"
      : "Não iniciada";
}
function atualizarMetadadosAula(id, dado) {
  for (const lista of [biblioteca, bibliotecaCompleta]) {
    const item = lista.find((a) => a.id === id);
    if (item) {
      if (dado.estudo) item.estudo = dado.estudo;
      if (dado.progresso) item.progresso = dado.progresso;
    }
  }
}
function registrarPosicao() {
  if (!aula || modoDemo) return filaEstudo;
  const id = aula.id,
    dado = {
      aulaId: id,
      aba,
      atividadeId:
        aula.modo === "funcoes"
          ? aula.exercicios[exercicioAtual]?.id
          : aula.missoes?.[missaoAtual]?.id,
      arquivo: arquivoAtual,
    };
  const trabalho = filaEstudo
    .then(() => api("/api/estudo", dado))
    .then((r) => atualizarMetadadosAula(id, r));
  filaEstudo = trabalho.catch((e) =>
    aviso("Não foi possível guardar o ponto de retomada: " + e.message, true),
  );
  return filaEstudo;
}
function renderizarInicioAluno() {
  const m = HubPercurso.sugerir(
      biblioteca,
      dadosJornada?.escolha,
      dadosJornada?.percursos,
    ),
    a = m.principal;
  $("inicio-titulo").textContent = m.finalizado
    ? "Você concluiu as aulas deste percurso."
    : m.retomando
      ? "Vamos continuar de onde você parou?"
      : "Vamos começar pelo primeiro passo.";
  $("inicio-descricao").textContent = !a
    ? "As aulas aparecem aqui quando você recebe o material do professor."
    : m.ativo
      ? `Seu percurso: ${m.ativo.nome}. A sequência foi definida pelo professor.`
      : "Suas aulas recebidas estão organizadas por número. Uma importação nova não muda seu ponto de retomada.";
  $("continuar-aula").textContent = !a
    ? "Conectar ao professor"
    : m.finalizado
      ? "Revisar uma aula ↗"
      : m.retomando
        ? "Retomar minha atividade ↗"
        : `Começar aula ${String(a.numero).padStart(2, "0")} ↗`;
  $("continuar-aula").onclick = tratar(async () =>
    m.aguardando
      ? mostrarRota("jornada")
      : a
        ? abrirAula(a.id, { retomar: true })
        : mostrarRota("conexao"),
  );
  if (m.aguardando) {
    $("inicio-titulo").textContent = m.disponiveis
      ? "Você concluiu as aulas liberadas."
      : "Seu planejamento está disponível.";
    $("continuar-aula").textContent = "Ver próximas liberações →";
  }
  $("home-acervo").textContent = "Ver todas as minhas aulas →";
  $("home-label").textContent = m.retomando
    ? "SEU PONTO DE RETOMADA"
    : m.finalizado
      ? "PERCURSO CONCLUÍDO"
      : "NA ORDEM DE ESTUDO";
  $("home-heading").textContent = m.ativo ? m.ativo.nome : "Seu próximo passo";
  $("home-total").textContent =
    `${m.disponiveis} aula(s) disponível(is)${m.ativo ? " · " + m.lista.length + " planejadas" : ""}`;
  $("home-nota").textContent =
    "O progresso conta desafios verificados, não arquivos importados. O planejamento pode mostrar etapas futuras; o conteúdo só abre depois da liberação do professor.";
  const resumo = $("home-percurso");
  resumo.hidden = false;
  resumo.replaceChildren();
  const contagem = elemento(resumo, "div", undefined, "percurso-contagem");
  elemento(
    contagem,
    "strong",
    `${m.concluidas} de ${m.lista.length} aulas concluídas`,
  );
  elemento(
    contagem,
    "span",
    `${m.iniciadas} em andamento · ${m.naoIniciadas} não iniciadas · ${m.bloqueadas.length} aguardando liberação`,
    "secondary",
  );
  const barra = elemento(resumo, "progress");
  barra.max = Math.max(1, m.lista.length);
  barra.value = m.concluidas;
  barra.setAttribute("aria-label", "Aulas recebidas concluídas");
  if (a) {
    const linha = elemento(resumo, "p");
    elemento(
      linha,
      "strong",
      m.aguardando
        ? "Próxima liberação: "
        : m.retomando
          ? "Você parou em: "
          : m.finalizado
            ? "Disponível para revisão: "
            : "Comece por: ",
    );
    elemento(
      linha,
      "span",
      `Aula ${String((m.aguardando ? m.bloqueadas[0] : a).numero).padStart(2, "0")} · ${(m.aguardando ? m.bloqueadas[0] : a).titulo}`,
    );
    if (m.retomando && a.estudo) {
      const s = a.estudo,
        abas = {
          estudar: "Entender",
          praticar: "Praticar",
          ambiente: "Ambiente",
          transferencia: "Fora do Hub",
        };
      elemento(
        resumo,
        "p",
        `${abas[s.aba] ?? "Entender"}${s.atividadeTitulo ? ` · Atividade ${s.indiceAtividade + 1} de ${s.totalAtividades}: ${s.atividadeTitulo}` : ""}`,
        "secondary",
      );
      if (s.atualizadaEm)
        elemento(
          resumo,
          "p",
          "Último acesso: " +
            new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(s.atualizadaEm)),
          "secondary",
        );
    }
  }
  if (m.finalizado)
    elemento(
      resumo,
      "p",
      "Tudo que está disponível aqui foi concluído. Você pode revisar enquanto aguarda novas aulas do professor.",
    );
  $("home-cards").replaceChildren();
  m.cards.forEach((item, i) => {
    const b = botao(
      $("home-cards"),
      "",
      () => abrirAula(item.id, { retomar: i === 0 && m.retomando }),
      "continue-card",
    );
    b.dataset.aulaId = item.id;
    if (item.disponivel === false) {
      b.disabled = true;
      b.classList.add("aula-bloqueada");
    }
    elemento(
      b,
      "span",
      item.disponivel === false
        ? "AULA PLANEJADA"
        : i === 0
          ? m.retomando
            ? "RETOMAR"
            : m.finalizado
              ? "REVISAR"
              : "COMEÇAR"
          : "NA SEQUÊNCIA",
      "eyebrow",
    );
    elemento(
      b,
      "h3",
      `Aula ${String(item.numero).padStart(2, "0")} · ${item.titulo}`,
    );
    elemento(b, "p", item.grupoPercurso ?? item.modulo ?? item.foco);
    elemento(b, "span", estadoDaAula(item), "lesson-progress");
    elemento(
      b,
      "span",
      item.disponivel === false
        ? "Planejamento recebido · conteúdo ainda não liberado"
        : `${item.progresso?.concluidos ?? 0} de ${item.progresso?.total ?? 0} desafios validados`,
      "secondary",
    );
    elemento(
      b,
      "span",
      item.disponivel === false
        ? "🔒 Aguardando o professor"
        : i === 0 && m.retomando
          ? "Retomar atividade →"
          : item.progresso?.completa
            ? "Revisar →"
            : "Abrir aula →",
      "lesson-link",
    );
  });
}
function renderizarPercursos() {
  if (!dadosJornada) return;
  $("resumo-jornada").replaceChildren();
  $("nav-trilhas-texto").textContent =
    perfil === "professor" ? "Trilhas do professor" : "Trilhas recebidas";
  const raiz = $("jornada");
  raiz.replaceChildren();
  elemento(
    raiz,
    "p",
    perfil === "professor"
      ? "ORGANIZE SEU ACERVO"
      : "PERCURSOS DO SEU PROFESSOR",
    "eyebrow",
  );
  elemento(
    raiz,
    "h1",
    perfil === "professor"
      ? "Trilhas do professor"
      : "Trilhas que você recebeu",
  );
  if (perfil === "professor") {
    renderizarTrilhasProfessor(raiz);
    return;
  }
  const escolha = dadosJornada.escolha;
  elemento(
    raiz,
    "p",
    "Seus objetivos são uma preferência pessoal. As trilhas abaixo são planejamentos criados pelo professor. O conteúdo de cada aula é recebido separadamente, depois da liberação.",
    "lead",
  );
  const objetivo = elemento(raiz, "div", undefined, "percurso-preferencia");
  elemento(
    objetivo,
    "p",
    escolha
      ? `Meu objetivo: ${nomesObjetivos[escolha.trilha]} · JavaScript`
      : "Você ainda não definiu um objetivo de estudo.",
  );
  botao(objetivo, "Alterar meus objetivos", abrirEscolhaJornada);
  const percursos = HubPercurso.recebidos(biblioteca, dadosJornada?.percursos);
  if (!percursos.length) {
    elemento(raiz, "h2", "Nenhuma trilha recebida ainda");
    elemento(
      raiz,
      "p",
      "Seu professor ainda não enviou uma organização de trilha. As aulas avulsas continuam disponíveis em Minhas aulas; o aplicativo não cria estágios por conta própria.",
    );
    botao(raiz, "Ver minhas aulas", () => mostrarRota("aulas"));
    return;
  }
  const ativo = HubPercurso.sugerir(
    biblioteca,
    escolha,
    dadosJornada?.percursos,
  ).ativo;
  for (const p of percursos) {
    const bloco = card(raiz, p.nome),
      feitas = p.aulas.filter((a) => a.progresso?.completa).length;
    elemento(
      bloco,
      "p",
      `${nomesObjetivos[p.objetivo]} · JavaScript · ${p.aulas.filter((a) => a.disponivel !== false).length} de ${p.aulas.length} aulas com conteúdo disponível`,
    );
    const alinhado =
      escolha?.trilha === p.objetivo && escolha?.linguagem === p.linguagem;
    elemento(
      bloco,
      "span",
      alinhado
        ? "Combina com seu objetivo"
        : "Você também pode escolher este percurso",
      "pill",
    );
    botao(
      bloco,
      ativo?.id === p.id ? "Continuar este percurso" : "Estudar este percurso",
      async () => {
        const r = await api("/api/jornada", {
          trilha:
            escolha?.trilha ??
            (p.objetivo === "outro" ? "backend" : p.objetivo),
          linguagem: "javascript",
          percursoId: p.id,
        });
        dadosJornada.escolha = r.escolha;
        renderizarInicio();
        mostrarRota("inicio");
      },
      "primary",
    );
    barraProgresso(
      bloco,
      p.aulas.length ? (feitas / p.aulas.length) * 100 : 0,
      `${feitas}/${p.aulas.length} aulas planejadas concluídas`,
    );
    let ultimoGrupo;
    for (const a of p.aulas) {
      if (a.grupoPercurso !== ultimoGrupo) {
        elemento(bloco, "h3", a.grupoPercurso);
        ultimoGrupo = a.grupoPercurso;
      }
      const texto = `Aula ${String(a.numero).padStart(2, "0")} · ${a.titulo}`;
      if (a.disponivel === false) {
        const linha = elemento(
          bloco,
          "div",
          undefined,
          "journey-lesson aula-bloqueada",
        );
        elemento(linha, "strong", "🔒 " + texto);
        elemento(
          linha,
          "span",
          "Aguardando liberação do professor. Você recebeu somente o planejamento.",
          "secondary",
        );
      } else
        botao(
          bloco,
          `${texto} — ${estadoDaAula(a)} · ${a.progresso?.concluidos ?? 0}/${a.progresso?.total ?? 0}`,
          () => abrirAula(a.id, { retomar: !!a.estudo?.iniciada }),
          "journey-lesson",
        );
    }
  }
}
function renderizarTrilhasProfessor(raiz) {
  elemento(
    raiz,
    "p",
    "Dê um nome ao percurso, defina seu objetivo, agrupe as aulas e escolha a ordem. Exporte ou publique esse planejamento antes das aulas: ele mostra apenas títulos, grupos e sequência. O conteúdo de cada aula é liberado separadamente.",
    "lead",
  );
  botao(raiz, "＋ Criar trilha", () => editarTrilha(), "primary");
  const planos = dadosJornada.percursos ?? [];
  if (!planos.length)
    elemento(
      raiz,
      "p",
      "Seu acervo ainda não tem trilhas criadas. Nenhuma organização é enviada automaticamente ao aluno.",
    );
  for (const p of planos) {
    const bloco = card(raiz, p.nome);
    elemento(
      bloco,
      "p",
      `${nomesObjetivos[p.objetivo]} · JavaScript · ${p.etapas.length} aulas organizadas`,
    );
    elemento(
      bloco,
      "p",
      p.etapas
        .map(
          (e) =>
            bibliotecaCompleta.find((a) => a.id === e.aulaId)?.titulo ??
            e.aulaId,
        )
        .join(" → "),
    );
    botao(bloco, "Editar grupos e sequência", () => editarTrilha(p));
    botao(bloco, "Exportar planejamento", async () => {
      const trilha = await api(
        "/api/percursos/exportar?id=" + encodeURIComponent(p.id),
      );
      baixar(
        new Blob([JSON.stringify(trilha, null, 2)], {
          type: "application/json",
        }),
        p.id + ".trilha-hub",
      );
    });
    botao(bloco, "Publicar planejamento para turma", () =>
      publicarPlanejamento(p),
    );
    botao(bloco, "Excluir organização", async () => {
      const r = await api("/api/percursos", { acao: "excluir", id: p.id });
      aplicarTrilhasProfessor(r.percursos);
    });
  }
  elemento(
    raiz,
    "p",
    "Depois de editar uma trilha, exporte ou publique novamente o planejamento. Você não precisa reenviar conteúdo de aulas. Cópias já recebidas pelo aluno não são alteradas silenciosamente.",
    "planning-note",
  );
}
function aplicarTrilhasProfessor(planos) {
  dadosJornada.percursos = planos;
  for (const a of bibliotecaCompleta)
    a.percursos = HubPercurso.descrever(planos, a.id);
  renderizarJornada();
}
async function publicarPlanejamento(plano) {
  const desktop = window.laboratorioDesktop;
  if (typeof desktop?.nuvem !== "function") {
    aviso(
      "Publique na edição desktop conectada. Nesta prévia você pode exportar o planejamento.",
      true,
    );
    return;
  }
  const estado = await desktop.nuvem("estado");
  if (!estado.conectado) {
    mostrarRota("conexao");
    aviso("Conecte o Professor ao serviço antes de publicar a trilha.");
    return;
  }
  const painel = await desktop.nuvem("painel");
  if (!painel.turmas.length) {
    mostrarRota("conexao");
    aviso("Crie uma turma antes de liberar o planejamento.");
    return;
  }
  const d = elemento(document.body, "dialog", undefined, "percurso-editor"),
    f = elemento(d, "form");
  elemento(f, "h2", "Liberar planejamento: " + plano.nome);
  elemento(
    f,
    "p",
    "O aluno receberá os títulos, grupos e a sequência. Os conteúdos continuarão bloqueados até você publicar cada aula em Conexões e atualizações.",
  );
  const label = elemento(f, "label", "Turma"),
    select = elemento(label, "select");
  for (const t of painel.turmas) {
    const o = elemento(select, "option", t.nome);
    o.value = t.id;
  }
  const erro = elemento(f, "p");
  erro.setAttribute("role", "alert");
  const b = elemento(f, "button", "Liberar somente planejamento", "primary");
  b.type = "submit";
  botao(f, "Cancelar", () => d.close());
  f.onsubmit = async (e) => {
    e.preventDefault();
    b.disabled = true;
    try {
      const trilha = await api(
        "/api/percursos/exportar?id=" + encodeURIComponent(plano.id),
      );
      await desktop.nuvem("publicar-trilha", { trilha, turmaId: select.value });
      d.close();
      aviso("Planejamento liberado. Nenhum conteúdo de aula foi enviado.");
    } catch (e) {
      erro.textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
  d.onclose = () => d.remove();
  d.showModal();
}
function editarTrilha(plano) {
  const d = elemento(document.body, "dialog", undefined, "percurso-editor"),
    f = elemento(d, "form");
  elemento(f, "h2", plano ? "Editar trilha" : "Criar trilha do professor");
  elemento(
    f,
    "p",
    "Marque as aulas que compõem o percurso. Use as setas para ordenar e escreva o nome do grupo de cada aula. Nenhum gabarito faz parte desses metadados.",
  );
  function campo(titulo, valor = "") {
    const label = elemento(f, "label", titulo),
      input = elemento(label, "input");
    input.value = valor;
    input.required = true;
    input.maxLength = 120;
    return input;
  }
  const nome = campo("Nome da trilha", plano?.nome),
    label = elemento(f, "label", "Objetivo do percurso"),
    objetivo = elemento(label, "select");
  for (const [id, t] of Object.entries(nomesObjetivos)) {
    const o = elemento(objetivo, "option", t);
    o.value = id;
    o.selected = id === (plano?.objetivo ?? "backend");
  }
  elemento(
    f,
    "p",
    "Linguagem: JavaScript. É a linguagem executável disponível no runtime atual.",
    "secondary",
  );
  const busca = campo("Buscar no acervo");
  busca.required = false;
  busca.type = "search";
  const lista = elemento(f, "div", undefined, "percurso-aulas-editor");
  const existentes = plano?.etapas ?? [],
    base = HubPercurso.ordenar(bibliotecaCompleta);
  const itens = [
    ...existentes
      .map((e) => ({
        aula: base.find((a) => a.id === e.aulaId),
        grupo: e.grupo,
        marcada: true,
      }))
      .filter((e) => e.aula),
    ...base
      .filter((a) => !existentes.some((e) => e.aulaId === a.id))
      .map((a) => ({
        aula: a,
        grupo: a.modulo ?? "Fundamentos",
        marcada: false,
      })),
  ];
  function render() {
    lista.replaceChildren();
    itens.forEach((item, index) => {
      const texto =
        `${item.aula.numero} ${item.aula.titulo} ${item.grupo}`.toLocaleLowerCase(
          "pt-BR",
        );
      if (!texto.includes(busca.value.toLocaleLowerCase("pt-BR"))) return;
      const linha = elemento(lista, "div", undefined, "percurso-aula-editor"),
        rotulo = elemento(linha, "label"),
        check = elemento(rotulo, "input");
      check.type = "checkbox";
      check.checked = item.marcada;
      check.onchange = () => (item.marcada = check.checked);
      elemento(
        rotulo,
        "span",
        `Aula ${String(item.aula.numero).padStart(2, "0")} · ${item.aula.titulo}`,
      );
      const grupo = elemento(linha, "input");
      grupo.value = item.grupo;
      grupo.maxLength = 120;
      grupo.placeholder = "Grupo";
      grupo.setAttribute("aria-label", "Grupo de " + item.aula.titulo);
      grupo.oninput = () => (item.grupo = grupo.value);
      for (const [delta, t] of [
        [-1, "↑"],
        [1, "↓"],
      ]) {
        const b = botao(linha, t, () => {
          const novo = index + delta;
          if (novo < 0 || novo >= itens.length) return;
          [itens[index], itens[novo]] = [itens[novo], itens[index]];
          render();
        });
        b.disabled = index + delta < 0 || index + delta >= itens.length;
        b.setAttribute(
          "aria-label",
          (delta < 0 ? "Subir " : "Descer ") + item.aula.titulo,
        );
      }
    });
  }
  busca.oninput = render;
  render();
  const erro = elemento(f, "p");
  erro.setAttribute("role", "alert");
  const acoes = elemento(f, "div", undefined, "grupo"),
    salvar = elemento(acoes, "button", "Salvar trilha", "primary");
  salvar.type = "submit";
  botao(acoes, "Cancelar", () => d.close());
  f.onsubmit = async (e) => {
    e.preventDefault();
    salvar.disabled = true;
    try {
      const r = await api("/api/percursos", {
        ...(plano ? { id: plano.id } : {}),
        nome: nome.value,
        objetivo: objetivo.value,
        linguagem: "javascript",
        etapas: itens
          .filter((e) => e.marcada)
          .map((e) => ({ aulaId: e.aula.id, grupo: e.grupo })),
      });
      d.close();
      aplicarTrilhasProfessor(r.percursos);
    } catch (e) {
      erro.textContent = e.message;
    } finally {
      salvar.disabled = false;
    }
  };
  d.onclose = () => d.remove();
  d.showModal();
}
