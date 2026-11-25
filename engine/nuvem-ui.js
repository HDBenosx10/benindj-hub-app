"use strict";
let painelNuvem,
  catalogoOnline,
  conexaoNuvem,
  nuvemOcupada = false;
const desktopNuvem = window.laboratorioDesktop;
const nuvemDisponivel = () => typeof desktopNuvem?.nuvem === "function";
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
  else await consultarCatalogoNuvem();
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
inicioCarregado
  .then(async () => {
    desktopNuvem?.aoAtualizar?.(renderizarEstadoUpdate);
    if (typeof desktopNuvem?.atualizacao === "function")
      renderizarEstadoUpdate(await desktopNuvem.atualizacao("estado"));
    await atualizarConexaoNuvem();
  })
  .catch((e) => mensagemNuvem(e.message, true));
