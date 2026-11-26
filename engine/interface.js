"use strict";
const colorirJS = HubEditor.colorirJS;
const $ = (id) => document.getElementById(id);
const TOKEN = document.querySelector('meta[name="lab-token"]').content;
const parametros = new URLSearchParams(location.search);
const previa = parametros.get("visao") === "aluno";
let perfil;
let biblioteca = [];
let aula;
let respostas;
let aba;
let exercicioAtual = 0;
let missaoAtual = 0;
let arquivoAtual;
let resultados = [];
let ocupado = false;
let timer;
let revisao = 0;
let apiAtiva = false;
let apiDesatualizada = false;
let sessao;
let modoDemo = false;
let painelDebug;
const editorCodigo = HubEditor.criar($("editor"), {
  nonce: TOKEN,
  aoFormatar: () => tratar(formatarEditor)(),
  aoVerificar: () => tratar(() => testar(false))(),
  aoBreakpoints: (linhas, automatico) =>
    painelDebug?.breakpoints(linhas, automatico),
  aoEstado: (estado) => {
    $("formatar-codigo").disabled =
      !aula || estado.somenteLeitura || !estado.podeFormatar;
    $("formatar-codigo").title = estado.somenteLeitura
      ? "Arquivo disponível somente para leitura"
      : estado.podeFormatar
        ? "Formatar JavaScript ou JSON · Shift+Alt+F"
        : "Formatação disponível para JavaScript e JSON";
  },
});
async function formatarEditor() {
  if (!aula || ocupado || editorCodigo.readOnly) return;
  $("formatar-codigo").disabled = true;
  const tinhaBreakpoints = editorCodigo.breakpoints.length > 0;
  try {
    const aplicado = await editorCodigo.formatar();
    if (!aplicado) {
      aviso("O editor mudou durante a formatação. Tente novamente.");
      return;
    }
    await salvar();
    aviso(
      "Código formatado e salvo. Ctrl+Z desfaz a formatação." +
        (tinhaBreakpoints && !editorCodigo.breakpoints.length
          ? " Os breakpoints foram limpos; marque novamente as linhas desejadas."
          : ""),
    );
  } catch (erro) {
    const posicao = erro.loc?.start;
    aviso(
      "Não foi possível formatar. Revise a sintaxe" +
        (posicao
          ? ` na linha ${posicao.line}, coluna ${posicao.column}`
          : " do arquivo") +
        ". Seu código foi mantido.",
      true,
    );
  } finally {
    editorCodigo.atualizarEstado();
  }
}
$("formatar-codigo").onclick = tratar(formatarEditor);
painelDebug = HubDebug({
  editor: editorCodigo,
  api,
  salvar,
  dados: comDados,
  contexto: () =>
    aula
      ? {
          perfil,
          aulaId: aula.id,
          exercicioId:
            aula.modo === "funcoes"
              ? aula.exercicios[exercicioAtual].id
              : undefined,
          arquivo:
            aula.modo === "funcoes"
              ? aula.exercicios[exercicioAtual].id + ".js"
              : arquivoAtual,
          funcoes: aula.modo === "funcoes",
          http: aula.projeto?.tipo === "http",
          habilitado:
            !modoDemo &&
            !ocupado &&
            (aula.modo === "funcoes" || /\.(js|cjs)$/.test(arquivoAtual)),
          linhasCodigo: editorCodigo.value.split("\n").length,
        }
      : null,
  abrirArquivo: async (nome) => {
    if (!aula.projeto?.arquivos.some((a) => a.nome === nome)) return;
    sincronizarEditor();
    arquivoAtual = nome;
    renderizarEditor();
  },
  bloquear: (valor) => {
    document.body.classList.toggle("debugando", valor);
    bloquear(ocupado);
    for (const id of [
      "run-livre",
      "abrir-js",
      "rascunho",
      "modo-experimento",
      "retomar",
    ])
      $(id).disabled = valor;
    document
      .querySelectorAll("#exercicios select")
      .forEach((s) => (s.disabled = valor));
    if (valor && apiAtiva) {
      apiAtiva = false;
      $("badge-projeto").textContent = "Parado para depurar";
    }
  },
});

function elemento(parent, tag, texto, classe) {
  const item = document.createElement(tag);
  if (texto !== undefined) {
    item.textContent = texto;
  }
  if (classe) {
    item.className = classe;
  }
  if (tag === "pre" && classe === "code") {
    item.innerHTML = colorirJS(texto ?? "");
  }
  parent.append(item);
  return item;
}
function aviso(texto, erro = false) {
  $("mensagem").textContent = texto;
  $("mensagem").hidden = false;
  if (document.body.classList.contains("no-estudio") && $("studio-status")) {
    $("studio-status").textContent = texto;
    $("studio-status").classList.toggle("erro", erro);
  }
  $("mensagem").classList.toggle("erro", erro);
}
function fmt(valor) {
  return JSON.stringify(valor, null, 2);
}
async function api(caminho, dado, binario = false) {
  if (dado && caminho.startsWith("/api/ambiente/"))
    dado = { ...dado, demonstracao: modoDemo };
  const opcoes = {
    headers: {
      "X-Lab-Token": TOKEN,
      "X-Lab-Visao": previa ? "aluno" : "normal",
    },
  };
  if (dado !== undefined) {
    opcoes.method = "POST";
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(dado);
  }
  const resposta = await fetch(caminho, opcoes);
  if (!resposta.ok) {
    const erro = await resposta.json();
    throw new Error(erro.erro ?? "A operação não foi concluída.");
  }
  return binario ? await resposta.blob() : await resposta.json();
}
function comDados(extra = {}) {
  return { aulaId: aula.id, ...respostas, ...extra };
}
function tratar(acao) {
  return async (...args) => {
    try {
      await acao(...args);
    } catch (erro) {
      aviso(erro.message, true);
    }
  };
}
function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function botao(parent, texto, acao, classe) {
  const item = elemento(parent, "button", texto, classe);
  item.type = "button";
  item.addEventListener("click", tratar(acao));
  return item;
}
function card(parent, titulo) {
  const item = elemento(parent, "section", undefined, "card");
  if (titulo) {
    elemento(item, "h2", titulo);
  }
  return item;
}

function renderizarBiblioteca() {
  const busca = $("busca").value.trim().toLocaleLowerCase("pt-BR");
  const modulo = $("filtro-modulo").value;
  $("aulas").replaceChildren();
  $("aula-compacta").replaceChildren();
  let encontrados = 0;
  aulasVisiveis = [];
  for (const item of biblioteca) {
    const opcao = elemento($("aula-compacta"), "option", item.titulo);
    opcao.value = item.id;
    opcao.selected = item.id === aula?.id;
    if (modulo && item.modulo !== modulo) continue;
    if (
      busca &&
      !(item.titulo + " " + item.foco + " " + item.modulo)
        .toLocaleLowerCase("pt-BR")
        .includes(busca)
    )
      continue;
    aulasVisiveis.push(item.id);
    const container = elemento(
      $("aulas"),
      "div",
      undefined,
      "lesson-selectable",
    );
    if (modoSelecaoAulas && perfil === "professor") {
      const label = elemento(container, "label", undefined, "lesson-selection");
      const check = elemento(label, "input");
      check.type = "checkbox";
      check.checked = aulasSelecionadas.has(item.id);
      check.onchange = () => {
        if (check.checked) aulasSelecionadas.add(item.id);
        else aulasSelecionadas.delete(item.id);
        atualizarSelecaoAulas();
      };
      elemento(
        label,
        "span",
        `Selecionar aula ${String(item.numero).padStart(2, "0")} — ${item.titulo}`,
      );
    }
    const b = botao(container, "", () => abrirAula(item.id), "lesson-card");
    elemento(
      b,
      "span",
      "AULA " + String(item.numero).padStart(2, "0"),
      "lesson-number",
    );
    elemento(b, "span", item.modulo, "lesson-module");
    elemento(b, "h3", item.titulo);
    elemento(b, "p", item.foco);
    if (perfil === "aluno")
      elemento(
        b,
        "span",
        `${estadoDaAula(item)} · ${item.progresso?.concluidos ?? 0}/${item.progresso?.total ?? 0} desafios validados`,
        "lesson-progress",
      );
    elemento(b, "span", "Abrir aula ↗", "lesson-link");
    encontrados++;
  }
  $("catalogo-vazio").hidden = encontrados !== 0;
  atualizarSelecaoAulas();
}
function mostrarRota(rota) {
  if (rota === "inicio" && perfil) renderizarInicio();
  document.body.classList.remove("resource-drawer-open");
  if (aba !== "ambiente") $("ambiente").hidden = true;
  const ids = {
    inicio: "inicio",
    aulas: "acervo",
    aula: "visao-aula",
    estudio: "estudio",
    coruja: "assistente",
    jornada: "jornada",
    conexao: "conexao",
  };
  for (const id of Object.values(ids)) $(id).hidden = id !== ids[rota];
  document.body.dataset.rota = rota;
  document.body.classList.remove("no-estudio");
  $("rota-titulo").textContent = {
    conexao: "Conexões e atualizações",
    inicio: "Início",
    aulas: perfil === "professor" ? "Acervo" : "Minhas aulas",
    aula: aula?.titulo ?? "Aula",
    estudio: "Criar aula",
    coruja: "DEV Coruja",
    jornada:
      perfil === "professor" ? "Trilhas do professor" : "Trilhas recebidas",
  }[rota];
  document
    .querySelectorAll("[data-rota]")
    .forEach((b) =>
      b.setAttribute(
        "aria-current",
        b.dataset.rota === rota ? "page" : "false",
      ),
    );
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderizarInicio() {
  if (perfil === "aluno") {
    renderizarInicioAluno();
    renderizarJornada();
    return;
  }
  $("home-percurso").hidden = true;
  $("inicio-titulo").textContent = "Seu espaço para ensinar.";
  $("inicio-descricao").textContent =
    "Organize suas trilhas, prepare as aulas e compartilhe o percurso no ritmo de cada turma.";
  $("continuar-aula").textContent = "＋ Criar uma aula";
  $("continuar-aula").onclick = tratar(async () => {
    rascunhoAula = undefined;
    await abrirEstudio();
  });
  $("home-acervo").textContent = "Explorar acervo →";
  $("home-label").textContent = "SEU ACERVO";
  $("home-heading").textContent = "Ensinar começa com uma boa aula.";
  $("home-total").textContent = biblioteca.length + " aulas no acervo";
  $("home-nota").textContent =
    "Crie as trilhas em Trilhas do professor. Grupos e sequência acompanham somente as aulas que você decidir compartilhar.";
  $("home-cards").replaceChildren();
  for (const item of HubPercurso.ordenar(biblioteca).slice(0, 3)) {
    const b = botao(
      $("home-cards"),
      "",
      () => abrirAula(item.id),
      "continue-card",
    );
    elemento(
      b,
      "span",
      "AULA " + String(item.numero).padStart(2, "0"),
      "eyebrow",
    );
    elemento(b, "h3", item.titulo);
    elemento(b, "p", item.foco);
    elemento(b, "span", "Preparar aula →", "lesson-link");
  }
  renderizarJornada();
}

function mostrarAba(nome) {
  if (nome === "preparar" || nome === "corrigir") {
    if (perfil !== "professor") return;
    $("preparar").hidden = nome !== "preparar";
    $("corrigir").hidden = nome !== "corrigir";
    if (!$("guia-professor").open) $("guia-professor").showModal();
    return;
  }
  if ($("guia-professor").open) $("guia-professor").close();
  $("mensagem").hidden = true;
  aba = nome;
  document.body.dataset.aba = nome;
  if (nome === "ambiente")
    carregarBancada().catch((e) => aviso(e.message, true));
  if (nome === "transferencia") renderizarTransferencia();
  mostrarRota("aula");
  if (nome === "praticar")
    requestAnimationFrame(() =>
      $("praticar").scrollIntoView({ block: "start" }),
    );
  for (const id of ["estudar", "praticar", "ambiente", "transferencia"])
    $(id).hidden = id !== nome;
  document
    .querySelectorAll(".lesson-nav [data-aba]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.aba === nome)),
    );
  registrarPosicao();
}

function renderizarPreparacao() {
  const raiz = $("preparar");
  raiz.replaceChildren();
  const liberar = card(raiz, "Liberação da aula pelo painel");
  liberar.classList.add("soft");
  elemento(
    liberar,
    "p",
    "Envie o aplicativo do aluno uma vez. Nas próximas aulas, envie apenas o arquivo pequeno da aula escolhida. O aluno usa Importar aula para abri-lo.",
  );
  const acoes = elemento(liberar, "div", undefined, "grupo");
  botao(acoes, "Aplicativo do aluno", baixarMotor);
  botao(acoes, "Baixar esta aula", baixarAula, "primary");
  elemento(
    liberar,
    "p",
    "O envio da aula usa os enunciados e os códigos iniciais. Seus gabaritos, rascunhos e o catálogo completo permanecem no pacote do professor.",
    "secondary",
  );
  const colunas = elemento(raiz, "div", undefined, "grid-two");
  const objetivos = card(colunas, "O que precisa ficar claro");
  const lista = elemento(objetivos, "ul", undefined, "objetivos");
  aula.objetivos.forEach((texto) => elemento(lista, "li", texto));
  const previos = card(colunas, "Antes desta aula");
  if (!aula.prerequisitos.length) {
    elemento(
      previos,
      "p",
      "Use esta unidade como diagnóstico da base já trabalhada com o aluno.",
    );
  }
  for (const numero of aula.prerequisitos) {
    const previaAula = biblioteca.find((item) => item.numero === numero);
    if (previaAula) {
      botao(previos, `Aula ${numero} · ${previaAula.titulo}`, () =>
        abrirAula(previaAula.id),
      );
    }
  }
  const roteiro = card(raiz, "Roteiro para conduzir o encontro");
  const fases = elemento(roteiro, "div", undefined, "timeline");
  for (const fase of aula.roteiro) {
    const bloco = elemento(fases, "div", undefined, "phase");
    elemento(bloco, "span", fase.tempo, "time");
    const conteudo = elemento(bloco, "div");
    elemento(conteudo, "strong", fase.titulo);
    elemento(conteudo, "p", fase.acao);
  }
  if (aula.projeto) {
    const arquivos = card(raiz, "O que o aluno recebe nesta etapa");
    elemento(
      arquivos,
      "p",
      aula.projeto.tipo === "http"
        ? "O projeto contém o que já foi construído nas etapas anteriores. Os arquivos de apoio ficam visíveis para acompanhar as chamadas. Os pontos desta aula estão marcados como TODO."
        : "O programa possui arquivos reais. Os comandos executam o programa nessa pasta de trabalho.",
    );
    const listaArquivos = elemento(arquivos, "ul", undefined, "objetivos");
    for (const arq of aula.projeto.arquivos) {
      elemento(
        listaArquivos,
        "li",
        `${arq.nome} · ${arq.editavel ? "implementar nesta aula" : "apoio já disponível para leitura"}`,
      );
    }
  }
  const fecho = card(raiz, "Evidência para avançar");
  if (aula.professor.curadoria) {
    const curadoria = card(raiz, "Diagnóstico e transferência");
    for (const [nome, texto] of Object.entries(aula.professor.curadoria)) {
      elemento(curadoria, "h3", nome);
      elemento(curadoria, "p", texto);
    }
  }
  elemento(fecho, "p", aula.professor.criterio);
  botao(fecho, "Começar a explicação", () => mostrarAba("estudar"), "primary");
}

function renderizarCorrecao() {
  const raiz = $("corrigir");
  raiz.replaceChildren();
  const abertura = card(raiz, "Gabarito do professor · " + aula.titulo);
  elemento(
    abertura,
    "p",
    "Soluções completas abaixo. Estes arquivos e as orientações de correção não são enviados ao aluno.",
  );
  const guia = card(raiz, "Pergunta e pontos de atenção");
  elemento(guia, "h3", aula.professor.pergunta);
  elemento(guia, "p", aula.professor.resposta);
  elemento(guia, "p", "Observe: " + aula.professor.errosComuns);
  if (aula.professor.orientacao) {
    elemento(guia, "p", aula.professor.orientacao);
  }
  const gabaritos =
    aula.modo === "funcoes"
      ? Object.entries(aula.professor.gabaritos)
      : Object.entries(aula.professor.solucaoProjeto);
  for (const [nome, codigo] of gabaritos) {
    const bloco = elemento(raiz, "details", undefined, "card");
    bloco.open = true;
    elemento(bloco, "summary", nome);
    botao(bloco, "Baixar solução · " + nome, () =>
      baixar(
        new Blob(["\uFEFF" + codigo], {
          type: "text/javascript;charset=utf-8",
        }),
        nome.endsWith(".js") || nome.endsWith(".cjs") || nome.endsWith(".json")
          ? nome
          : nome + ".js",
      ),
    );
    elemento(bloco, "pre", codigo, "code");
  }
}

function sincronizarEditor() {
  if (!aula) {
    return;
  }
  if (modoDemo) {
    return;
  }
  if (aula.modo === "funcoes") {
    respostas.codigos[aula.exercicios[exercicioAtual].id] = editorCodigo.value;
  } else {
    const arquivo = aula.projeto.arquivos.find(
      (item) => item.nome === arquivoAtual,
    );
    if (arquivo.editavel) {
      respostas.arquivos[arquivoAtual] = editorCodigo.value;
    }
  }
}
async function salvar() {
  clearTimeout(timer);
  if (!aula) {
    return;
  }
  await filaEstudo;
  sincronizarEditor();
  const versao = revisao;
  const id = aula.id;
  $("salvo").textContent = "Salvando…";
  const salvo = await api("/api/salvar", comDados());
  atualizarMetadadosAula(id, salvo);
  if (document.body.dataset.rota === "inicio") renderizarInicio();
  renderizarProgressoAula();
  if (id === aula.id && versao === revisao) {
    $("salvo").textContent = "Salvo localmente";
  }
}
function renderizarEditor() {
  if (aula.modo === "funcoes") {
    const exercicio = aula.exercicios[exercicioAtual];
    editorCodigo.abrir(
      aula.id + ":" + exercicio.id,
      exercicio.id + ".js",
      respostas.codigos[exercicio.id],
      ocupado || painelDebug.ativo(),
    );
    $("nome-editor").textContent = exercicio.id + ".js";
    $("enunciado").textContent = exercicio.enunciado;
    renderizarBriefing(exercicio);
  } else {
    const arquivo = aula.projeto.arquivos.find(
      (item) => item.nome === arquivoAtual,
    );
    $("arquivo").value = arquivoAtual;
    editorCodigo.abrir(
      aula.id + ":" + arquivoAtual + ":" + modoDemo,
      arquivoAtual,
      modoDemo
        ? aula.professor.solucaoProjeto[arquivoAtual]
        : respostas.arquivos[arquivoAtual],
      modoDemo || !arquivo.editavel || ocupado || painelDebug.ativo(),
    );
    $("nome-editor").textContent = arquivoAtual;
    $("enunciado").textContent = aula.desafio;
    renderizarBriefing();
    $("permissao").textContent = modoDemo
      ? "Referência da demonstração · leitura"
      : arquivo.editavel
        ? "Arquivo editável nesta etapa"
        : "Apoio disponível para leitura";
  }
  $("salvo").textContent = "Salvo automaticamente";
  painelDebug.contextoAtualizado();
}
function renderizarTestes() {
  const testes =
    aula.modo === "funcoes"
      ? aula.exercicios[exercicioAtual].testes
      : aula.projeto.testes;
  const correntes =
    aula.modo === "funcoes"
      ? resultados.filter(
          (item) => item.exercicioId === aula.exercicios[exercicioAtual].id,
        )
      : resultados;
  $("testes").replaceChildren();
  testes.forEach((teste, indice) => {
    const resultado = correntes[indice];
    const item = elemento(
      $("testes"),
      "details",
      undefined,
      "test" + (resultado ? (resultado.passou ? " passou" : " falhou") : ""),
    );
    const titulo = elemento(item, "summary");
    elemento(titulo, "span", teste.nome);
    elemento(
      titulo,
      "span",
      resultado ? (resultado.passou ? "Passou" : "Revisar") : "Aguardando",
      "resultado",
    );
    const detalhe = elemento(item, "div", undefined, "detalhe-teste");
    if (!resultado) {
      elemento(
        detalhe,
        "p",
        "Execute a verificação para observar o comportamento.",
      );
      return;
    }
    elemento(detalhe, "strong", "Esperado");
    elemento(detalhe, "pre", resultado.esperado);
    elemento(detalhe, "strong", "Recebido e percurso observado");
    elemento(detalhe, "pre", resultado.recebido);
    if (resultado.registros?.length) {
      elemento(detalhe, "strong", "Console");
      elemento(detalhe, "pre", resultado.registros.join("\n"));
    }
  });
  const total =
    aula.modo === "funcoes"
      ? aula.exercicios.reduce((s, e) => s + e.testes.length, 0)
      : testes.length;
  const passaram = resultados.filter((item) => item.passou).length;
  $("placar").textContent = `${passaram} de ${total} cenários passaram`;
  $("concluido").hidden = passaram !== total;
}
function renderizarPratica() {
  focarPratica("codigo");
  $("pratica-titulo").textContent =
    aula.modo === "funcoes" ? "Seu laboratório" : "Explore o projeto";
  $("pratica-descricao").textContent =
    aula.modo === "funcoes"
      ? "Escreva. Execute. Observe. Verifique quando estiver pronto."
      : "Edite os pontos desta etapa e observe o programa executando seus próprios arquivos.";
  $("exercicios").replaceChildren();
  const atividades =
    aula.modo === "funcoes" ? aula.exercicios : (aula.missoes ?? []);
  if (atividades.length > 1) {
    const label = elemento($("exercicios"), "label", "Atividade");
    const select = elemento(label, "select");
    select.setAttribute("aria-label", "Atividade da aula");
    atividades.forEach((e, i) => {
      const o = elemento(
        select,
        "option",
        `${i + 1} de ${atividades.length} · ${e.titulo}`,
      );
      o.value = i;
      o.selected =
        i === (aula.modo === "funcoes" ? exercicioAtual : missaoAtual);
    });
    select.onchange = tratar(async () => {
      await salvar();
      if (aula.modo === "funcoes") exercicioAtual = Number(select.value);
      else missaoAtual = Number(select.value);
      renderizarPratica();
      await registrarPosicao();
    });
  }
  const projeto = aula.modo === "projeto";
  const http = projeto && aula.projeto.tipo === "http";
  $("arquivos").hidden = !projeto;
  $("arquivo").replaceChildren();
  if (projeto) {
    aula.projeto.arquivos.forEach((arq) => {
      const opcao = elemento(
        $("arquivo"),
        "option",
        arq.nome + (arq.editavel ? " · editar" : " · apoio"),
      );
      opcao.value = arq.nome;
    });
  }
  $("testar").textContent = "✓ Verificar";
  $("run-livre").hidden = projeto;
  $("exploracao").hidden = projeto;
  $("testar-tudo").hidden = projeto;
  $("executar-projeto").hidden = !http;
  $("parar-projeto").hidden = !http;
  $("observatorio").hidden = !http;
  $("terminal").hidden = !projeto || http;
  $("ver-banco").hidden = !http || !aula.projeto.usaBanco;
  $("abrir-js").hidden = projeto;
  if (projeto && !http) {
    $("comando").replaceChildren();
    aula.projeto.comandos.forEach((comando) => {
      const opcao = elemento($("comando"), "option", comando.texto);
      opcao.value = comando.id;
    });
  }
  if (http) {
    $("modelo-request").replaceChildren();
    aula.projeto.requisicoes.forEach((request, indice) => {
      const opcao = elemento($("modelo-request"), "option", request.nome);
      opcao.value = indice;
    });
    $("executar-cliente").hidden = !aula.projeto.arquivos.some(
      (arq) => arq.nome === "cliente.cjs",
    );
    for (const id of [
      "rotulo-funcao-cliente",
      "funcao-cliente",
      "orientacao-cliente",
    ])
      $(id).hidden = $("executar-cliente").hidden;
    $("funcao-cliente").value = "consultarProdutos";
    preencherRequest();
    mostrarObservacao("http");
  }
  renderizarEditor();
  renderizarTestes();
}
function preencherRequest() {
  const request = aula.projeto.requisicoes[Number($("modelo-request").value)];
  if (!request) {
    return;
  }
  $("metodo").value = request.metodo;
  $("caminho").value = request.caminho;
  $("corpo").value = request.corpo ? fmt(request.corpo) : "";
}
function mostrarObservacao(nome) {
  for (const id of ["http", "banco", "log"]) {
    $("observar-" + id).hidden = id !== nome;
  }
  document
    .querySelectorAll("[data-observar]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.observar === nome)),
    );
}

async function abrirAula(id, opcoes = {}) {
  if (ocupado) {
    return;
  }
  await painelDebug.parar();
  await filaEstudo;
  await salvar();
  if (apiAtiva && aula) {
    await api("/api/projeto/parar", { aulaId: aula.id });
  }
  if (aula?.ambiente) await api("/api/ambiente/parar", { aulaId: aula.id });
  document.body.classList.remove("no-estudio");
  $("estudio").hidden = true;
  const dados = await api("/api/aula?aula=" + encodeURIComponent(id));
  aula = dados.aula;
  estadoBancada = undefined;
  recursoSelecionado = null;
  renderizarMapaRecursos();
  renderizarProgressoAula();
  $("aba-ambiente").hidden = !aula.ambiente;
  respostas = dados.respostas;
  respostas.experimentos ??= {};
  resultados = [];
  const retomada = dados.estudo ?? {};
  exercicioAtual =
    aula.modo === "funcoes"
      ? Math.max(
          0,
          aula.exercicios.findIndex((e) => e.id === retomada.atividadeId),
        )
      : 0;
  missaoAtual =
    aula.modo === "projeto"
      ? Math.max(
          0,
          (aula.missoes ?? []).findIndex((e) => e.id === retomada.atividadeId),
        )
      : 0;
  arquivoAtual = aula.projeto?.arquivos.some((f) => f.nome === retomada.arquivo)
    ? retomada.arquivo
    : aula.projeto?.arquivoInicial;
  apiAtiva = false;
  apiDesatualizada = false;
  sessao = undefined;
  modoDemo = false;
  $("retomar").hidden = true;
  $("titulo").textContent = aula.titulo;
  $("etiqueta").textContent =
    `AULA ${String(aula.numero).padStart(2, "0")} · ${aula.modulo ?? (aula.modo === "projeto" ? "PROJETO" : "FUNDAMENTOS")}`;
  $("contexto").textContent = aula.foco ?? aula.contexto;
  $("estado-projeto").textContent =
    "Clique em Executar projeto para abrir sua API local.";
  $("badge-projeto").textContent = "Parado";
  $("sessao").textContent = "Sem sessão de login";
  $("resposta-http").textContent =
    "A resposta virá do servidor que está executando seus arquivos.";
  $("logs").textContent = "Nenhuma mensagem emitida pela aplicação.";
  $("tabela-banco").replaceChildren();
  if (perfil === "professor") {
    renderizarPreparacao();
    renderizarCorrecao();
  }
  renderizarEstudo();
  renderizarPratica();
  renderizarBiblioteca();
  mostrarAba(
    opcoes.retomar &&
      ["estudar", "praticar", "ambiente", "transferencia"].includes(
        retomada.aba,
      )
      ? retomada.aba
      : "estudar",
  );
  await filaEstudo;
  localStorage.setItem("ultima-aula-" + perfil, id);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function bloquear(valor) {
  ocupado = valor;
  for (const id of [
    "testar",
    "testar-tudo",
    "executar-projeto",
    "executar-comando",
    "arquivo",
    "recomecar",
  ]) {
    $(id).disabled = valor || (id !== "arquivo" && painelDebug?.ativo());
  }
  editorCodigo.readOnly =
    valor ||
    painelDebug?.ativo() ||
    modoDemo ||
    (aula.modo === "projeto" &&
      !aula.projeto.arquivos.find((a) => a.nome === arquivoAtual).editavel);
  $("testar").disabled = valor || modoDemo || painelDebug?.ativo();
  $("recomecar").disabled = valor || modoDemo || painelDebug?.ativo();
}
async function testar(todos = false) {
  if (ocupado || painelDebug.ativo()) {
    return;
  }
  if (modoDemo) {
    throw new Error(
      "Use Retomar atividade para verificar o código da tentativa.",
    );
  }
  bloquear(true);
  try {
    await salvar();
    aviso(
      aula.modo === "projeto"
        ? "Executando os cenários em uma cópia isolada do seu projeto…"
        : "Verificando os resultados das funções…",
    );
    const extras =
      aula.modo === "funcoes" && !todos
        ? { exercicioId: aula.exercicios[exercicioAtual].id }
        : {};
    $("verificacoes").open = true;
    const retorno = await api("/api/testar", comDados(extras));
    focarPratica("testes");
    const itemAtual = biblioteca.find((a) => a.id === aula.id);
    const antes = itemAtual?.progresso;
    if (itemAtual) itemAtual.progresso = retorno.progresso;
    renderizarProgressoAula();
    celebrarProgresso(antes, retorno.progresso);
    renderizarInicio();
    if (aula.modo === "funcoes" && !todos) {
      resultados = resultados
        .filter((item) => item.exercicioId !== extras.exercicioId)
        .concat(retorno.resultados);
    } else {
      resultados = retorno.resultados;
    }
    renderizarTestes();
    aviso(
      "Verificação concluída. Abra um cenário para acompanhar o esperado e o percurso recebido.",
    );
  } finally {
    bloquear(false);
  }
}
async function iniciarProjeto(demonstracao = false) {
  if (ocupado) {
    return;
  }
  bloquear(true);
  aviso("Iniciando seu servidor…");
  try {
    await salvar();
    const retorno = await api(
      "/api/projeto/iniciar",
      comDados({ demonstracao }),
    );
    apiAtiva = true;
    renderizarMapaRecursos();
    apiDesatualizada = false;
    modoDemo = demonstracao;
    $("retomar").hidden = !modoDemo;
    renderizarEditor();
    $("estado-projeto").textContent =
      `Servidor real disponível em ${retorno.base}. ${demonstracao ? "Demonstração com a implementação de referência." : "Está executando seus arquivos."}`;
    $("badge-projeto").textContent = demonstracao
      ? "Demonstração"
      : "Em execução";
    $("logs").textContent =
      retorno.logs.join("\n") || "Nenhuma mensagem emitida pela aplicação.";
    mostrarAba("praticar");
    focarPratica("execucao");
    aviso("Projeto iniciado. Envie uma requisição e acompanhe a resposta.");
  } catch (erro) {
    apiAtiva = false;
    $("badge-projeto").textContent = "Falha ao iniciar";
    $("estado-projeto").textContent =
      "Confira o erro e aplique a correção antes de executar novamente.";
    modoDemo = false;
    $("retomar").hidden = true;
    renderizarEditor();
    throw erro;
  } finally {
    bloquear(false);
  }
}
async function baixarAula() {
  const arquivo = await api(
    "/api/exportar-aula?aula=" + aula.id,
    undefined,
    true,
  );
  baixar(arquivo, aula.id + ".aula-hub");
  aviso(
    "Aula liberada. Envie esse arquivo ao aluno; ele importa no motor que já possui.",
  );
}
async function baixarMotor() {
  const dado = await api("/api/motor-aluno");
  $("ajuda-texto").replaceChildren();
  elemento($("ajuda-texto"), "p", dado.instrucoes);
  if (dado.url) {
    const a = elemento($("ajuda-texto"), "a", "Abrir releases do aplicativo");
    a.href = dado.url;
    a.target = "_blank";
  }
  $("dialog-ajuda").showModal();
}

document
  .querySelectorAll("[data-aba]")
  .forEach((b) => (b.onclick = () => mostrarAba(b.dataset.aba)));
document
  .querySelectorAll("[data-observar]")
  .forEach((b) => (b.onclick = () => mostrarObservacao(b.dataset.observar)));
$("busca").oninput = renderizarBiblioteca;
$("aula-compacta").onchange = tratar(() => abrirAula($("aula-compacta").value));
$("arquivo").onchange = tratar(async () => {
  await salvar();
  arquivoAtual = $("arquivo").value;
  renderizarEditor();
  await registrarPosicao();
});
editorCodigo.oninput = () => {
  if (!aula) return;
  sincronizarEditor();
  revisao++;
  if (aula.modo === "funcoes") {
    resultados = resultados.filter(
      (r) => r.exercicioId !== aula.exercicios[exercicioAtual].id,
    );
  } else {
    resultados = [];
  }
  if (apiAtiva) {
    $("badge-projeto").textContent = "Reexecute para aplicar";
    apiDesatualizada = true;
  }
  renderizarTestes();
  $("salvo").textContent = "Salvando…";
  clearTimeout(timer);
  timer = setTimeout(
    () => salvar().catch((e) => aviso("Falha ao salvar: " + e.message, true)),
    500,
  );
};
$("testar").onclick = tratar(() => testar(false));
$("testar-tudo").onclick = tratar(() => testar(true));
$("executar-projeto").onclick = tratar(() => iniciarProjeto(false));
$("parar-projeto").onclick = tratar(async () => {
  await api("/api/projeto/parar", { aulaId: aula.id });
  apiAtiva = false;
  $("badge-projeto").textContent = "Parado";
  $("estado-projeto").textContent =
    "Servidor encerrado. O arquivo de banco permanece para a próxima execução.";
});
$("retomar").onclick = tratar(async () => {
  await api("/api/projeto/parar", { aulaId: aula.id });
  apiAtiva = false;
  modoDemo = false;
  sessao = undefined;
  $("retomar").hidden = true;
  $("badge-projeto").textContent = "Parado";
  $("estado-projeto").textContent =
    "Implemente sua solução e use Executar projeto para observar o resultado.";
  renderizarEditor();
  aviso("Atividade retomada com o código da sua tentativa.");
});
$("executar-comando").onclick = tratar(async () => {
  await salvar();
  const retorno = await api(
    "/api/comando",
    comDados({ comandoId: $("comando").value }),
  );
  $("saida-terminal").textContent =
    "$ " +
    retorno.comando +
    "\n\n" +
    retorno.saida +
    (retorno.aviso ? "\n" + retorno.aviso : "") +
    "\nCódigo de saída: " +
    retorno.codigo;
  $("arquivo-gerado").hidden = !retorno.arquivoGerado;
  if (retorno.arquivoGerado) {
    $("arquivo-gerado").querySelector("pre").textContent =
      retorno.arquivoGerado;
  }
});
$("modelo-request").onchange = preencherRequest;
$("enviar-request").onclick = tratar(async () => {
  if (!apiAtiva) {
    throw new Error("Clique em Executar projeto antes de enviar a requisição.");
  }
  if (apiDesatualizada) {
    throw new Error(
      "Reexecute o projeto para aplicar as alterações do editor.",
    );
  }
  const requisicao = {
    metodo: $("metodo").value,
    caminho: $("caminho").value,
    tokenManual: sessao,
  };
  if ($("corpo").value.trim()) {
    requisicao.corpo = JSON.parse($("corpo").value);
  }
  const retorno = await api("/api/projeto/requisitar", {
    aulaId: aula.id,
    requisicao,
  });
  $("status-http").textContent =
    `HTTP ${retorno.status} · ${retorno.duracaoMs} ms · ${retorno.headers["content-type"] ?? ""}`;
  $("resposta-http").textContent = fmt(retorno.json);
  $("logs").textContent =
    retorno.logs.join("\n") || "Nenhuma mensagem emitida pela aplicação.";
  if (retorno.status === 200 && retorno.json?.token) {
    sessao = retorno.json.token;
    $("sessao").textContent =
      "Sessão recebida do login e aplicada às próximas requisições";
  }
  if (requisicao.caminho === "/logout" && retorno.status === 204) {
    sessao = undefined;
    $("sessao").textContent = "Sessão encerrada no servidor";
  }
});
$("limpar-sessao").onclick = () => {
  sessao = undefined;
  $("sessao").textContent = "Sem sessão de login";
};
$("executar-cliente").onclick = tratar(async () => {
  if (!apiAtiva || apiDesatualizada) {
    throw new Error(
      "Execute o projeto com o código atual antes de chamar o cliente.",
    );
  }
  const retorno = await api("/api/projeto/cliente", {
    aulaId: aula.id,
    token: sessao,
    funcao: $("funcao-cliente").value,
    produto:
      $("funcao-cliente").value === "criarProduto"
        ? JSON.parse($("corpo").value || "null")
        : undefined,
  });
  $("resposta-http").textContent = fmt(retorno.valor);
  $("status-http").textContent =
    `Resultado de ${$("funcao-cliente").value} em cliente.cjs`;
});
$("consultar-banco").onclick = tratar(async () => {
  const retorno = await api("/api/projeto/sql", {
    aulaId: aula.id,
    sql: $("consulta").value,
  });
  const root = $("tabela-banco");
  root.replaceChildren();
  elemento(
    root,
    "p",
    `${retorno.linhas.length} linha(s) retornada(s).`,
    "secondary",
  );
  if (retorno.linhas.length) {
    const tabela = elemento(root, "table");
    const tr = elemento(elemento(tabela, "thead"), "tr");
    const colunas = Object.keys(retorno.linhas[0]);
    colunas.forEach((c) => elemento(tr, "th", c));
    const body = elemento(tabela, "tbody");
    retorno.linhas.forEach((linha) => {
      const tr = elemento(body, "tr");
      colunas.forEach((c) => elemento(tr, "td", String(linha[c])));
    });
  }
});
$("recomecar").onclick = tratar(async () => {
  if (
    !confirm(
      "Voltar ao código inicial do arquivo ou exercício atual? Baixe suas respostas antes se quiser preservar a tentativa.",
    )
  ) {
    return;
  }
  editorCodigo.value =
    aula.modo === "funcoes"
      ? aula.exercicios[exercicioAtual].codigoInicial
      : aula.projeto.arquivos.find((a) => a.nome === arquivoAtual).codigo;
  editorCodigo.notificarAlteracao();
});
$("baixar-respostas").onclick = tratar(async () => {
  await salvar();
  const dado = { schema: 3, tipo: "resposta", aulaId: aula.id, ...respostas };
  baixar(
    new Blob(["\ufeff", fmt(dado)], { type: "application/json;charset=utf-8" }),
    aula.id + ".respostas.json",
  );
});
$("importar").onclick = () => $("arquivo-importado").click();
$("arquivo-importado").onchange = tratar(async () => {
  const arquivos = [...$("arquivo-importado").files];
  $("arquivo-importado").value = "";
  if (arquivos.reduce((n, f) => n + f.size, 0) > 32000000)
    throw Error("Selecione até 32 MB por lote.");
  if (!arquivos.length) return;
  const fontes = await Promise.all(
    arquivos.map(async (f) => {
      try {
        return { nome: f.name, conteudo: await f.text() };
      } catch (erro) {
        return { nome: f.name, erro: erro.message };
      }
    }),
  );
  let respostaUnica;
  if (fontes.length === 1 && fontes[0].conteudo) {
    try {
      respostaUnica = JSON.parse(fontes[0].conteudo.replace(/^\uFEFF/, ""));
    } catch {}
  }
  if (respostaUnica?.tipo !== "resposta") {
    await importarFontesEmLote(fontes);
    return;
  }
  const arquivo = arquivos[0];
  if (!arquivo) {
    return;
  }
  const dado = JSON.parse((await arquivo.text()).replace(/^\uFEFF/, ""));
  $("arquivo-importado").value = "";
  if (dado.tipo === "resposta") {
    if (!biblioteca.some((item) => item.id === dado.aulaId)) {
      throw new Error("Abra primeiro a aula correspondente a essas respostas.");
    }
    await abrirAula(dado.aulaId);
    await api("/api/salvar", {
      aulaId: aula.id,
      codigos: dado.codigos,
      arquivos: dado.arquivos,
      experimentos: dado.experimentos,
    });
    const retorno = await api("/api/aula?aula=" + aula.id);
    respostas = retorno.respostas;
    resultados = [];
    renderizarPratica();
    mostrarAba("praticar");
    aviso(
      "Respostas carregadas. Rode os testes para conferir a implementação.",
    );
  } else {
    const retorno = await api("/api/importar-aula", dado);
    await carregarInicio(retorno.id);
    aviso("Aula importada. Comece pela explicação e pela construção guiada.");
  }
});
$("abrir-js").onclick = () => $("js-importado").click();
$("js-importado").onchange = tratar(async () => {
  const arquivo = $("js-importado").files[0];
  if (arquivo) {
    editorCodigo.value = (await arquivo.text()).replace(/^\uFEFF/, "");
    editorCodigo.notificarAlteracao();
  }
  $("js-importado").value = "";
});
$("liberar").onclick = tratar(baixarAula);
$("motor").onclick = tratar(baixarMotor);
$("previa").onclick = () =>
  window.open("/?visao=aluno&aula=" + aula.id, "_blank");
$("ajuda").onclick = () => {
  $("ajuda-texto").replaceChildren();
  const textos =
    perfil === "professor"
      ? [
          "Abra uma aula no Acervo. Use Entender e Praticar; consulte a condução e os gabaritos em Material do professor.",
          "Envie o aplicativo do aluno uma vez. Depois use Liberar aula e envie somente o arquivo .aula-hub.",
          "A prévia projeta o conteúdo do aluno. A referência e o catálogo completo ficam no seu painel.",
        ]
      : [
          "Use Importar aula para abrir o arquivo liberado pelo professor.",
          "Comece em Entender e avance para Praticar. Executar mostra a saída; Verificar confere os critérios. Seu código é salvo automaticamente.",
          "No menu Arquivo do editor, use Exportar respostas. Você pode importar esse arquivo para recuperar seu trabalho.",
        ];
  textos.forEach((texto) => elemento($("ajuda-texto"), "p", texto));
  $("dialog-ajuda").showModal();
};
$("fechar-ajuda").onclick = () => $("dialog-ajuda").close();
$("encerrar").onclick = tratar(async () => {
  await salvar();
  clearTimeout(timer);
  await api("/api/encerrar", {});
  document.querySelector("main").replaceChildren();
  elemento(document.querySelector("main"), "h1", "Laboratório encerrado");
  elemento(
    document.querySelector("main"),
    "p",
    "Suas respostas foram salvas. Para voltar, abra o aplicativo BeninDJ Hub novamente.",
  );
});

async function carregarInicio(preferida, { manterTela = false } = {}) {
  const dados = await api(
    "/api/inicio" +
      (previa ? "?aula=" + encodeURIComponent(parametros.get("aula")) : ""),
  );
  perfil = dados.perfil;
  dadosJornada = dados.jornada;
  bibliotecaCompleta = HubPercurso.ordenar(dados.aulas);
  biblioteca = HubPercurso.ordenar(dados.aulas);
  $("versao-app").textContent = "v" + (dados.versaoApp ?? "0.7.0");
  $("perfil").textContent = perfil === "professor" ? "Professor" : "Aluno";
  $("importar").textContent =
    perfil === "professor" ? "↓ Importar respostas" : "↓ Importar aulas";
  $("motor").hidden = perfil !== "professor";
  $("acoes-professor").hidden = perfil !== "professor";
  $("aba-preparar").hidden = perfil !== "professor";
  $("aba-corrigir").hidden = perfil !== "professor";
  $("nav-professor").hidden = perfil !== "professor";
  $("abrir-guia").hidden = perfil !== "professor";
  $("nav-acervo-texto").textContent =
    perfil === "professor" ? "Acervo" : "Minhas aulas";
  $("catalogo-titulo").textContent =
    perfil === "professor" ? "Seu acervo" : "Minhas aulas";
  $("nota-biblioteca").textContent =
    perfil === "professor"
      ? `${biblioteca.length} aulas. Use o painel para criar, revisar e liberar desafios.`
      : "Aqui aparecem apenas as aulas já liberadas neste motor.";
  const ultimo =
    preferida ??
    (previa
      ? parametros.get("aula")
      : localStorage.getItem("ultima-aula-" + perfil));
  const id = biblioteca.some((item) => item.id === ultimo)
    ? ultimo
    : (biblioteca.find((item) => item.numero === 0)?.id ?? biblioteca[0]?.id);
  if (!id) {
    throw new Error("Importe o arquivo de uma aula para começar.");
  }
  if (preferida || previa) await abrirAula(id);
  $("filtro-modulo").replaceChildren();
  elemento($("filtro-modulo"), "option", "Todos os assuntos").value = "";
  for (const modulo of new Set(biblioteca.map((a) => a.modulo)))
    elemento($("filtro-modulo"), "option", modulo).value = modulo;
  renderizarBiblioteca();
  renderizarInicio();
  if (!preferida && !manterTela) mostrarRota("inicio");
  if (perfil === "aluno" && !previa && !dadosJornada?.escolha)
    abrirEscolhaJornada();
}
const inicioCarregado = new Promise((resolve) =>
  document.addEventListener("DOMContentLoaded", resolve, { once: true }),
)
  .then(() => carregarInicio())
  .catch((erro) =>
    aviso(erro.message + " Abra o laboratório pelo aplicativo.", true),
  );

$("voltar-conceito").onclick = () => mostrarAba("estudar");
$("rascunho").oninput = () => {
  if (aula?.modo !== "funcoes") {
    return;
  }
  respostas.experimentos[aula.exercicios[exercicioAtual].id] =
    $("rascunho").value;
  clearTimeout(timer);
  timer = setTimeout(() => salvar().catch((e) => aviso(e.message, true)), 500);
};
$("limpar-console").onclick = () => {
  $("console-livre").textContent = "Console limpo.";
};
$("run-livre").onclick = tratar(async () => {
  const botao = $("run-livre");
  botao.disabled = true;
  $("console-livre").textContent = "Executando seu programa…";
  try {
    sincronizarEditor();
    await salvar();
    const codigo =
      ($("modo-experimento").value === "desafio"
        ? editorCodigo.value + "\n;\n"
        : "") + $("rascunho").value;
    const retorno = await api("/api/executar", { aulaId: aula.id, codigo });
    $("console-livre").textContent = [
      ...retorno.saida,
      retorno.erro ??
        (retorno.saida.length
          ? "Concluído em " + retorno.duracao + " ms."
          : "Concluído sem mensagens. Use console.log para observar valores."),
    ].join("\n");
  } finally {
    botao.disabled = false;
  }
});

if (window.laboratorioDesktop) {
  const desktop = window.laboratorioDesktop;
  const receber = tratar(async (fontes) => {
    await inicioCarregado;
    await importarFontesEmLote(fontes);
  });
  if (desktop.aoAbrirAulas) desktop.aoAbrirAulas(receber);
  else
    desktop.aoAbrirAula((dado) =>
      receber([{ nome: "Aula recebida", conteudo: JSON.stringify(dado) }]),
    );
}

if (window.laboratorioDesktop) {
  window.laboratorioDesktop.aoFechar(async () => {
    clearTimeout(timer);
    await salvar();
    if (typeof persistirRascunhoProfessor === "function") {
      await persistirRascunhoProfessor();
    }
  });
}

document.querySelectorAll("[data-rota]").forEach(
  (b) =>
    (b.onclick = tratar(async () => {
      await salvar();
      mostrarRota(b.dataset.rota);
    })),
);
$("marca-inicio").onclick = tratar(async (e) => {
  e.preventDefault();
  await salvar();
  mostrarRota("inicio");
});
$("home-acervo").onclick = () => mostrarRota("aulas");
$("voltar-acervo").onclick = () => mostrarRota("aulas");
$("filtro-modulo").onchange = renderizarBiblioteca;
$("abrir-guia").onclick = () => mostrarAba("preparar");
$("fechar-guia").onclick = () => $("guia-professor").close();
$("nav-coruja").onclick = tratar(async () => {
  if (typeof abrirCoruja === "function") await abrirCoruja();
});
