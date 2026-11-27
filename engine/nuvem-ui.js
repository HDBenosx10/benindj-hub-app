"use strict";
let painelNuvem,
  catalogoOnline,
  conexaoNuvem,
  nuvemOcupada = false;
const desktopNuvem = window.laboratorioDesktop;
let sincronizadorAulas;
const nuvemDisponivel = () => typeof desktopNuvem?.nuvem === "function";
async function publicarAtualizacaoAula(id) {
  if (perfil !== "professor" || !nuvemDisponivel())
    throw Error("Abra o Professor desktop conectado ao acervo para enviar uma atualização.");
  const estado = await desktopNuvem.nuvem("estado");
  if (!estado.conectado) {
    mostrarRota("conexao");
    throw Error("A aula foi salva localmente. Conecte seu acervo para publicá-la.");
  }
  const painel = await desktopNuvem.nuvem("painel");
  const liberadas = new Set(painel.liberacoes.filter((l) => l.aula_id === id).map((l) => l.turma_id));
  const turmas = painel.turmas.filter((t) => liberadas.has(t.id));
  if (!turmas.length) {
    mostrarRota("conexao");
    throw Error("Esta aula ainda não foi liberada para uma turma. Publique a primeira liberação em Conexões e atualizações.");
  }
  const pacote = await api("/api/aulas/exportar", { ids: [id] });
  const d = elemento(document.body, "dialog", undefined, "dialogo-lote");
  elemento(d, "h2", "Enviar atualização da aula");
  elemento(d, "p", pacote.aulas[0].titulo);
  elemento(d, "p", "Escolha as turmas que já receberam esta aula. Alunos conectados recebem a revisão automaticamente; quem estiver usando a aula verá um aviso para aplicá-la. Códigos salvos são preservados. Salvar sem publicar mantém o rascunho privado.");
  const escolhas = turmas.map((turma) => {
    const linha = elemento(d, "label", undefined, "item-importacao");
    const check = elemento(linha, "input"); check.type = "checkbox"; check.checked = true;
    elemento(linha, "span", turma.nome);
    return { turma, check };
  });
  const status = elemento(d, "p"); status.setAttribute("role", "status");
  const acoes = elemento(d, "footer"), cancelar = botao(acoes, "Agora não", () => d.close());
  const enviar = botao(acoes, "Enviar atualização às turmas", async () => {
    const selecionadas = escolhas.filter((e) => e.check.checked);
    if (!selecionadas.length) { status.textContent = "Selecione pelo menos uma turma."; return; }
    enviar.disabled = cancelar.disabled = true;
    for (const { check } of escolhas) check.disabled = true;
    d.oncancel = (e) => e.preventDefault();
    let sucesso = 0;
    const falhas = [];
    for (const { turma } of selecionadas) {
      try {
        await desktopNuvem.nuvem("publicar", { turmaId: turma.id, aulas: pacote.aulas });
        sucesso++;
      } catch (e) { falhas.push(turma.nome + ": " + e.message); }
    }
    status.textContent = `${sucesso} turma(s) atualizada(s).` + (falhas.length ? " Falhas: " + falhas.join("; ") : " Os alunos receberão a revisão quando estiverem conectados.");
    enviar.hidden = true; cancelar.disabled = false; cancelar.textContent = "Concluir"; d.oncancel = null;
    aviso(status.textContent, falhas.length > 0);
  }, "primary");
  d.onclose = () => d.remove();
  d.showModal();
}
$("publicar-revisao-professor").onclick = tratar(async () => {
  if (aula) await publicarAtualizacaoAula(aula.id);
});
function mensagemNuvem(texto, erro = false) {
  $("nuvem-status").textContent = texto;
  $("nuvem-status").classList.toggle("erro", erro);
}
function ocuparNuvem(valor) {
  nuvemOcupada = valor;
  for (const b of $("conexao").querySelectorAll("button,input,select,textarea"))
    b.disabled = valor;
}
async function acaoNuvem(acao) {
  if (nuvemOcupada) return;
  ocuparNuvem(true);
  try {
    await acao();
  } catch (e) {
    mensagemNuvem(e.message, true);
  } finally {
    ocuparNuvem(false);
  }
}
function conviteGerado(dado) {
  $("convite-gerado-texto").value = dado.convite;
  $("convite-gerado").showModal();
}
async function atualizarConexaoNuvem() {
  const professor = perfil === "professor";
  $("nuvem-cabecalho-titulo").textContent = professor
    ? "Sua turma, no seu ritmo"
    : "Seu acervo, sempre por perto";
  $("nuvem-introducao").textContent = professor
    ? "Crie turmas, libere apenas as aulas escolhidas e gere um convite individual para cada aluno. Gabaritos permanecem no Professor."
    : "Receba aulas liberadas pelo professor e mantenha o aplicativo atualizado. O que já foi baixado continua disponível offline.";
  $("nuvem-conectar-titulo").textContent = professor
    ? "Conectar meu acervo"
    : "Conectar ao professor";
  $("form-nuvem-professor").hidden = !professor;
  $("form-nuvem-aluno").hidden = professor;
  if (!nuvemDisponivel()) {
    mensagemNuvem(
      "A conexão com o acervo e o updater ficam disponíveis na edição desktop. Esta prévia continua usando as aulas locais.",
    );
    for (const el of $("conexao").querySelectorAll("input,textarea,button"))
      el.disabled = true;
    $("update-status").textContent =
      "Abra a edição instalada para consultar atualizações.";
    return;
  }
  conexaoNuvem = await desktopNuvem.nuvem("estado");
  $("nuvem-conectar").hidden = conexaoNuvem.conectado;
  $("nuvem-conectado").hidden = !conexaoNuvem.conectado;
  $("nuvem-area-professor").hidden = !professor;
  $("nuvem-area-aluno").hidden = professor;
  $("nuvem-origem").textContent = conexaoNuvem.url ?? "";
  if (!conexaoNuvem.conectado) return;
  if (professor) await carregarPainelNuvem();
  else {
    await consultarCatalogoNuvem();
    await sincronizadorAulas?.verificar();
  }
}
async function consultarCatalogoNuvem() {
  catalogoOnline = await desktopNuvem.nuvem("catalogo");
  $("nuvem-turma-aluno").textContent =
    "Sua turma: " + catalogoOnline.turma.nome;
  const raiz = $("nuvem-catalogo");
  raiz.replaceChildren();
  let novas = 0;
  for (const p of catalogoOnline.percursos ?? []) {
    const atual =
      dadosJornada?.percursos?.find((t) => t.id === p.trilha.id)
        ?.revisaoOnline === p.revisao;
    if (!atual) novas++;
    const linha = elemento(raiz, "div", undefined, "nuvem-linha");
    elemento(linha, "strong", "Trilha · " + p.trilha.nome);
    elemento(
      linha,
      "span",
      atual
        ? "Planejamento já recebido"
        : "Planejamento disponível · não inclui conteúdo de aulas",
      "secondary",
    );
  }
  for (const a of catalogoOnline.aulas) {
    const local = bibliotecaCompleta.find((l) => l.id === a.id),
      atual = local?.revisaoOnline === a.revisao;
    if (!atual) novas++;
    const linha = elemento(raiz, "div", undefined, "nuvem-linha");
    elemento(
      linha,
      "strong",
      `Aula ${String(a.numero).padStart(2, "0")} · ${a.titulo}`,
    );
    elemento(
      linha,
      "span",
      atual
        ? "Já recebida"
        : local
          ? "Revisão disponível"
          : "Disponível para receber",
      "secondary",
    );
  }
  if (!catalogoOnline.aulas.length)
    elemento(
      raiz,
      "p",
      "Seu professor ainda não liberou aulas para esta turma.",
    );
  mensagemNuvem(
    novas
      ? `${novas} item(ns) para conferir: trilhas e aulas são recebidas separadamente. Seu código local será preservado.`
      : "Acervo conferido. Suas aulas locais continuam disponíveis offline.",
  );
  $("nav-conexao").textContent = novas
    ? `Conexões · ${novas} aula(s)`
    : "Conexões e atualizações";
}
async function carregarPainelNuvem() {
  painelNuvem = await desktopNuvem.nuvem("painel");
  const anterior = $("nuvem-turma").value;
  $("nuvem-turma").replaceChildren();
  for (const t of painelNuvem.turmas) {
    const opt = elemento($("nuvem-turma"), "option", t.nome);
    opt.value = t.id;
  }
  if (painelNuvem.turmas.some((t) => t.id === anterior))
    $("nuvem-turma").value = anterior;
  renderizarTurmaNuvem();
}
function renderizarTurmaNuvem() {
  const turmaId = $("nuvem-turma").value,
    alunos = $("nuvem-alunos"),
    liberadas = $("nuvem-liberadas"),
    aulas = $("nuvem-aulas-professor");
  alunos.replaceChildren();
  liberadas.replaceChildren();
  aulas.replaceChildren();
  for (const a of bibliotecaCompleta) {
    const label = elemento(aulas, "label"),
      check = elemento(label, "input");
    check.type = "checkbox";
    check.value = a.id;
    elemento(
      label,
      "span",
      `Aula ${String(a.numero).padStart(2, "0")} · ${a.titulo}`,
    );
  }
  for (const l of painelNuvem.liberacoes.filter(
    (l) => l.turma_id === turmaId,
  )) {
    const linha = elemento(liberadas, "div", undefined, "nuvem-linha");
    elemento(
      linha,
      "strong",
      bibliotecaCompleta.find((a) => a.id === l.aula_id)?.titulo ?? l.aula_id,
    );
    botao(linha, "Retirar da turma", () =>
      acaoNuvem(async () => {
        await desktopNuvem.nuvem("retirar-aula", {
          turmaId,
          aulaId: l.aula_id,
        });
        await carregarPainelNuvem();
        mensagemNuvem(
          "Aula retirada das próximas sincronizações. Downloads anteriores permanecem locais.",
        );
      }),
    );
  }
  for (const a of painelNuvem.alunos.filter((a) => a.turma_id === turmaId)) {
    const linha = elemento(alunos, "div", undefined, "nuvem-linha");
    const c = painelNuvem.convites.find(
      (c) => c.aluno_id === a.id && !c.revogado_em,
    );
    elemento(linha, "strong", a.nome);
    elemento(
      linha,
      "span",
      a.revogado_em
        ? "Acesso revogado"
        : a.dispositivo_id
          ? "Instalação ativada"
          : c?.expira_em < Date.now()
            ? "Convite expirado"
            : "Aguardando ativação",
      "secondary",
    );
    if (!a.revogado_em)
      botao(linha, "Revogar acesso", () =>
        acaoNuvem(async () => {
          await desktopNuvem.nuvem("revogar", { alunoId: a.id });
          await carregarPainelNuvem();
          mensagemNuvem("Acesso revogado para novas sincronizações.");
        }),
      );
    botao(linha, "Trocar computador / novo convite", () =>
      acaoNuvem(async () => {
        const r = await desktopNuvem.nuvem("reemitir", { alunoId: a.id });
        await carregarPainelNuvem();
        conviteGerado(r);
      }),
    );
  }
  if (!turmaId) {
    elemento(alunos, "p", "Crie uma turma para começar.");
    elemento(liberadas, "p", "Nenhuma turma selecionada.");
  }
}
const avisoAtualizacaoApp = HubNotificacoes.criar({
  mostrar: ({ texto }) => {
    $("atualizacao-app-texto").textContent = texto;
    $("atualizacao-app").hidden = false;
  },
  ocultar: () => { $("atualizacao-app").hidden = true; },
});
$("atualizacao-app-fechar").onclick = () => avisoAtualizacaoApp.fechar();
$("atualizacao-app-instalar").onclick = () => acaoUpdate("instalar");
function renderizarEstadoUpdate(estado) {
  $("update-status").textContent =
    estado.mensagem ?? `Versão atual: ${estado.versaoAtual}`;
  $("update-baixar").hidden = estado.fase !== "disponivel";
  $("update-baixar").textContent = estado.portable
    ? "Baixar nova portable"
    : "Baixar atualização";
  $("update-baixar").dataset.portable = String(estado.portable);
  $("update-instalar").hidden = estado.fase !== "pronta";
  $("update-progresso").hidden = !["baixando", "baixando-portable"].includes(
    estado.fase,
  );
  $("update-progresso").value = estado.progresso ?? 0;
  if (estado.fase === "disponivel" || estado.fase === "pronta")
    $("nav-conexao").textContent = "Conexões · atualização disponível";
  else if (estado.fase === "baixando") $("nav-conexao").textContent = "Conexões · baixando atualização";
  else $("nav-conexao").textContent = "Conexões e atualizações";
  if (estado.fase === "pronta") avisoAtualizacaoApp.exibir({
    chave: "pronta:" + estado.novaVersao,
    texto: `A versão ${estado.novaVersao} foi baixada e está pronta. Atualize quando quiser; seu trabalho será salvo antes de reiniciar.`,
  });
  else avisoAtualizacaoApp.exibir(null);
}
$("form-nuvem-professor").onsubmit = (e) => {
  e.preventDefault();
  acaoNuvem(async () => {
    await desktopNuvem.nuvem("conectar-professor", {
      url: $("nuvem-url").value,
      token: $("nuvem-token").value,
    });
    $("nuvem-token").value = "";
    await atualizarConexaoNuvem();
    mensagemNuvem(
      "Acervo conectado. Crie uma turma e escolha as aulas que deseja liberar.",
    );
  });
};
$("form-nuvem-aluno").onsubmit = (e) => {
  e.preventDefault();
  acaoNuvem(async () => {
    await desktopNuvem.nuvem("ativar", {
      convite: $("nuvem-convite").value.trim(),
    });
    $("nuvem-convite").value = "";
    await atualizarConexaoNuvem();
  });
};
$("nuvem-desconectar").onclick = () =>
  acaoNuvem(async () => {
    await desktopNuvem.nuvem("desconectar");
    await atualizarConexaoNuvem();
    mensagemNuvem(
      "Instalação desconectada. Aulas, respostas e bancos locais foram mantidos.",
    );
  });
$("form-criar-turma").onsubmit = (e) => {
  e.preventDefault();
  acaoNuvem(async () => {
    const t = await desktopNuvem.nuvem("turma", {
      nome: $("nuvem-nova-turma").value,
    });
    $("nuvem-nova-turma").value = "";
    await carregarPainelNuvem();
    $("nuvem-turma").value = t.id;
    renderizarTurmaNuvem();
    mensagemNuvem("Turma criada.");
  });
};
$("nuvem-turma").onchange = renderizarTurmaNuvem;
$("form-criar-convite").onsubmit = (e) => {
  e.preventDefault();
  acaoNuvem(async () => {
    if (!$("nuvem-turma").value) throw Error("Crie uma turma primeiro.");
    const r = await desktopNuvem.nuvem("convite", {
      turmaId: $("nuvem-turma").value,
      nomeAluno: $("nuvem-nome-aluno").value,
    });
    $("nuvem-nome-aluno").value = "";
    await carregarPainelNuvem();
    conviteGerado(r);
  });
};
$("nuvem-publicar").onclick = () =>
  acaoNuvem(async () => {
    if (!$("nuvem-turma").value) throw Error("Escolha uma turma.");
    const ids = [
      ...$("nuvem-aulas-professor").querySelectorAll("input:checked"),
    ].map((i) => i.value);
    if (!ids.length) throw Error("Selecione as aulas que deseja publicar.");
    const aulas = [];
    for (const id of ids) {
      const blob = await api("/api/exportar-aula?aula=" + id, undefined, true);
      aulas.push(JSON.parse((await blob.text()).replace(/^\uFEFF/, "")));
    }
    mensagemNuvem("Publicando as aulas selecionadas…");
    const r = await desktopNuvem.nuvem("publicar", {
      turmaId: $("nuvem-turma").value,
      aulas,
    });
    await carregarPainelNuvem();
    mensagemNuvem(
      `${r.publicadas} aula(s) publicadas para esta turma, sem gabaritos.`,
    );
  });
$("nuvem-consultar").onclick = () => acaoNuvem(consultarCatalogoNuvem);
$("nuvem-sincronizar").onclick = () =>
  acaoNuvem(async () => {
    await consultarCatalogoNuvem();
    const ids = catalogoOnline.aulas
      .filter(
        (a) =>
          bibliotecaCompleta.find((l) => l.id === a.id)?.revisaoOnline !==
          a.revisao,
      )
      .map((a) => a.id);
    const percursoIds = (catalogoOnline.percursos ?? [])
      .filter(
        (p) =>
          dadosJornada?.percursos?.find((t) => t.id === p.trilha.id)
            ?.revisaoOnline !== p.revisao,
      )
      .map((p) => p.trilha.id);
    if (!ids.length && !percursoIds.length) {
      mensagemNuvem("Nenhuma revisão nova para receber.");
      return;
    }
    mensagemNuvem("Recebendo as aulas liberadas…");
    const r = await desktopNuvem.nuvem("sincronizar", { ids, percursoIds });
    if (r.fontes.length) await importarFontesEmLote(r.fontes);
    await consultarCatalogoNuvem();
    if (r.indisponiveis.length)
      mensagemNuvem(
        `${r.indisponiveis.length} aula(s) exigem atualizar o aplicativo antes de receber.`,
      );
  });
$("convite-fechar").onclick = () => {
  $("convite-gerado").close();
  $("convite-gerado-texto").value = "";
};
$("convite-copiar").onclick = async () => {
  const campo = $("convite-gerado-texto");
  campo.select();
  try {
    await navigator.clipboard.writeText(campo.value);
    $("convite-copiar").textContent = "Copiado";
  } catch {
    $("convite-copiar").textContent = "Selecionado · use Ctrl+C";
  }
};
async function acaoUpdate(op) {
  try {
    const r = await desktopNuvem.atualizacao(op);
    if (op === "portable") {
      $("update-status").textContent = r.cancelado
        ? "Download cancelado."
        : "Portable conferida e salva. Substitua a versão anterior quando terminar.";
    } else if (r) renderizarEstadoUpdate(r);
  } catch (e) {
    $("update-status").textContent = e.message;
  }
}
$("update-verificar").onclick = () => acaoUpdate("verificar");
$("update-baixar").onclick = () =>
  acaoUpdate(
    $("update-baixar").dataset.portable === "true" ? "portable" : "baixar",
  );
$("update-instalar").onclick = () => acaoUpdate("instalar");
function podeAplicarRevisao() {
  return !nuvemOcupada && !ocupado && !painelDebug?.ativo() && !apiAtiva &&
    !$("run-livre").disabled && !document.querySelector("dialog[open]");
}
async function aplicarRevisoesAutomaticas(fontes, { incluirAberta } = {}) {
  // Compartilha a fila com importação manual. Nunca exibe um diálogo em segundo plano.
  const trabalho = filaImportacoes.then(async () => {
    if (!podeAplicarRevisao()) throw Error("Aguarde a execução ou feche o diálogo antes de aplicar a revisão.");
    const id = aula?.id;
    const atualizaAberta = id && fontes.some((f) => JSON.parse(f.conteudo).id === id);
    if (atualizaAberta && !incluirAberta)
      throw Error("A aula foi aberta durante a consulta. A revisão será oferecida sem interromper sua atividade.");
    if (aula) bloquear(true);
    try {
      await salvar();
      const plano = await api("/api/aulas/preparar-importacao", { fontes });
      if (plano.linhas.some((l) => !["existente", "igual"].includes(l.situacao)))
        throw Error("A revisão automática não corresponde às aulas já recebidas.");
      const chaves = plano.linhas.filter((l) => l.situacao === "existente").map((l) => l.chave);
      const retorno = await api("/api/aulas/confirmar-importacao", { planoId: plano.planoId, chaves });
      if (retorno.resumo.falhas) throw Error("Não foi possível aplicar todas as revisões. Seus códigos foram preservados.");
      await carregarInicio(undefined, { manterTela: true });
    } finally { if (aula) bloquear(false); }
    if (atualizaAberta && aula?.id === id) {
      const rota = document.body.dataset.rota;
      await abrirAula(id, { retomar: true, semSalvar: true });
      if (rota !== "aula") mostrarRota(rota);
    }
  });
  filaImportacoes = trabalho.catch(() => {});
  return trabalho;
}
const avisoRevisao = HubNotificacoes.criar({
  mostrar: ({ texto, podeAplicar }) => {
    $("revisao-acervo-texto").textContent = texto;
    $("aplicar-revisao-acervo").hidden = !podeAplicar;
    $("revisao-acervo").hidden = false;
  },
  ocultar: () => { $("revisao-acervo").hidden = true; },
});
$("fechar-revisao-acervo").onclick = () => avisoRevisao.fechar();
function estadoRevisoes(estado) {
  const revisoes = JSON.stringify(estado.revisoes ?? estado.pendentes);
  if (estado.erro) {
    avisoRevisao.exibir({ chave: "erro:" + estado.erro,
      texto: "Atualizações das aulas: " + estado.erro + " O material já recebido continua salvo. Tentaremos novamente quando houver conexão." });
  } else if (estado.pendentes.length) {
    avisoRevisao.exibir({ chave: "pendentes:" + revisoes, podeAplicar: true,
      texto: "Seu professor publicou uma atualização para " + estado.pendentes.join(", ") + ". Seu código será mantido. Pare a execução ou o debugger e aplique quando estiver pronto. Você também pode recebê-la depois em Conexões e atualizações." });
  } else if (estado.aplicadas?.length) {
    avisoRevisao.exibir({ chave: "aplicadas:" + JSON.stringify(estado.revisoesAplicadas ?? estado.aplicadas), duracao: 10000,
      texto: "Atualização do professor recebida: " + estado.aplicadas.join(", ") + ". Seus códigos foram mantidos. Exercícios com critérios alterados precisam ser verificados novamente." });
  } else if (estado.exigeAtualizacao) {
    avisoRevisao.exibir({ chave: "runtime:" + JSON.stringify(estado.incompativeis ?? []),
      texto: "Há uma revisão de aula que exige atualizar o aplicativo. Acesse Conexões e atualizações." });
  } else avisoRevisao.exibir(null);
}
async function verificarRevisoesAulas() {
  if (perfil !== "aluno" || previa || !nuvemDisponivel() || nuvemOcupada || document.hidden) return;
  const estado = await desktopNuvem.nuvem("estado");
  if (estado.conectado) await sincronizadorAulas?.verificar();
}
$("aplicar-revisao-acervo").onclick = tratar(async () => {
  if (!podeAplicarRevisao()) { aviso("Pare a execução ou o debugger e feche os diálogos antes de atualizar."); return; }
  const botao = $("aplicar-revisao-acervo"); botao.disabled = true;
  try { await sincronizadorAulas.aplicarAgora(); }
  finally { botao.disabled = false; }
});
inicioCarregado
  .then(async () => {
    desktopNuvem?.aoAtualizar?.(renderizarEstadoUpdate);
    if (typeof desktopNuvem?.atualizacao === "function")
      renderizarEstadoUpdate(await desktopNuvem.atualizacao("estado"));
    if (perfil === "aluno" && !previa && nuvemDisponivel()) {
      sincronizadorAulas = HubAtualizacoesAcervo.criar({
        listar: () => desktopNuvem.nuvem("catalogo"),
        locais: () => bibliotecaCompleta,
        receber: (ids) => desktopNuvem.nuvem("sincronizar", { ids, percursoIds: [] }),
        aplicar: aplicarRevisoesAutomaticas,
        protegidas: () => aula ? [aula.id] : [],
        podeAplicar: podeAplicarRevisao,
        aoEstado: estadoRevisoes,
      });
      setInterval(() => verificarRevisoesAulas().catch(() => {}), 120000);
      let ultimaConsulta = 0;
      const conferirAoVoltar = () => {
        if (Date.now() - ultimaConsulta < 10000) return;
        ultimaConsulta = Date.now(); verificarRevisoesAulas().catch(() => {});
      };
      window.addEventListener("focus", conferirAoVoltar);
      window.addEventListener("online", conferirAoVoltar);
    }
    await atualizarConexaoNuvem();
  })
  .catch((e) => mensagemNuvem(e.message, true));
