// Coloração local: o código é tratado como texto e nunca executado aqui.
function colorirJS(codigo) {
  const escapar = (texto) =>
    texto.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const palavras = new Set(
    "async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield".split(
      " ",
    ),
  );
  const padrao =
    /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?|\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|[a-zA-Z_$][\w$]*/g;
  let fim = 0;
  let html = "";
  for (const token of codigo.matchAll(padrao)) {
    html += escapar(codigo.slice(fim, token.index));
    const texto = token[0];
    let classe = "";
    if (texto.startsWith("//") || texto.startsWith("/*")) {
      classe = "comentario";
    } else if (/^["'`]/.test(texto)) {
      classe = "string";
    } else if (/^\d/.test(texto)) {
      classe = "numero";
    } else if (palavras.has(texto)) {
      classe = "palavra";
    } else if (/^(true|false|null|undefined|NaN|Infinity)$/.test(texto)) {
      classe = "literal";
    } else if (/^\s*\(/.test(codigo.slice(token.index + texto.length))) {
      classe = "funcao";
    }
    html += classe
      ? `<span class="js-${classe}">${escapar(texto)}</span>`
      : escapar(texto);
    fim = token.index + texto.length;
  }
  return html + escapar(codigo.slice(fim));
}

("use strict");
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
  const busca = $("busca").value.trim().toLowerCase();
  $("aulas").replaceChildren();
  $("aula-compacta").replaceChildren();
  let grupo;
  for (const item of biblioteca) {
    const opcao = elemento(
      $("aula-compacta"),
      "option",
      `${String(item.numero).padStart(2, "0")} · ${item.titulo}`,
    );
    opcao.value = item.id;
    opcao.selected = item.id === aula?.id;
    if (
      busca &&
      !(item.titulo + " " + item.foco + " " + item.modulo).toLowerCase().includes(busca)
    ) {
      continue;
    }
    if (item.modulo !== grupo) {
      grupo = item.modulo;
      elemento($("aulas"), "div", grupo, "section-title");
    }
    const b = botao(
      $("aulas"),
      `${String(item.numero).padStart(2, "0")} · ${item.titulo}`,
      () => abrirAula(item.id),
    );
    b.setAttribute("aria-current", String(item.id === aula?.id));
  }
}

function mostrarAba(nome) {
  document.body.classList.remove("no-estudio");
  $("estudio").hidden = true;
  aba = nome;
  for (const id of ["preparar", "estudar", "praticar", "corrigir"]) {
    $(id).hidden = id !== nome;
  }
  document
    .querySelectorAll("[data-aba]")
    .forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === nome)));
}

function renderizarPreparacao() {
  const raiz = $("preparar");
  raiz.replaceChildren();
  const liberar = card(raiz, "Liberação da aula pelo painel");
  liberar.classList.add("soft");
  elemento(
    liberar,
    "p",
    "Envie o aplicativo do aluno uma vez. Nas próximas aulas, envie apenas o arquivo pequeno da aula escolhida. O aluno usa Importar arquivo para abri-lo.",
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
  elemento(fecho, "p", aula.professor.criterio);
  botao(fecho, "Começar a explicação", () => mostrarAba("estudar"), "primary");
}

function renderizarEstudo() {
  const raiz = $("estudar");
  raiz.replaceChildren();
  const contexto = card(raiz, aula.foco);
  elemento(contexto, "p", aula.contexto);
  const objetivos = elemento(contexto, "ul", undefined, "objetivos");
  aula.objetivos.forEach((texto) => elemento(objetivos, "li", texto));
  const teoria = card(raiz, "Entender antes de implementar");
  aula.conceitos.forEach((texto) => elemento(teoria, "p", texto));
  if (aula.rastro) {
    elemento(teoria, "h3", "O caminho dos dados nesta aplicação");
    const fluxo = elemento(teoria, "div", undefined, "flow");
    aula.rastro.forEach((texto) => elemento(fluxo, "span", texto));
  }
  const exemplo = card(raiz, "Exemplo para construir e explicar");
  if (aula.exemploArquivo) {
    elemento(exemplo, "p", aula.exemploArquivo, "secondary");
  }
  elemento(exemplo, "pre", aula.exemplo, "code");
  const observacoes = elemento(exemplo, "ul", undefined, "objetivos");
  aula.exemploExplicado.forEach((texto) => elemento(observacoes, "li", texto));
  if (aula.modo === "funcoes") {
    const saida = elemento(
      exemplo,
      "pre",
      "Preveja o resultado antes de executar.",
      "console",
    );
    botao(exemplo, "Executar exemplo", async () => {
      const retorno = await api("/api/exemplo", comDados());
      saida.textContent =
        retorno.resultados
          .flatMap((teste) => (teste.passou ? teste.registros : [teste.recebido]))
          .join("\n") || "Exemplo concluído.";
    });
  } else if (perfil === "professor" && aula.projeto.tipo === "http") {
    elemento(
      exemplo,
      "p",
      "Na demonstração, execute a implementação de referência e envie as requisições da aula. Depois volte aos arquivos iniciais para construir a solução com o aluno.",
    );
    botao(exemplo, "Executar demonstração da etapa", () => iniciarProjeto(true));
  }
  const construindo = card(raiz, "Construção guiada");
  const passos = elemento(construindo, "div", undefined, "steps");
  for (const passo of aula.construcao) {
    const bloco = elemento(passos, "div", undefined, "step");
    elemento(bloco, "h3", passo.titulo);
    elemento(bloco, "p", passo.texto);
  }
  elemento(
    construindo,
    "p",
    "Após cada passo, peça uma previsão e observe o resultado antes da próxima mudança.",
    "callout",
  );
  botao(construindo, "Ir para a prática", () => mostrarAba("praticar"), "primary");
  if (aula.tarefas) {
    const contrato = card(raiz, "Contrato da implementação");
    for (const tarefa of aula.tarefas) {
      elemento(contrato, "h3", tarefa.titulo);
      elemento(contrato, "p", tarefa.texto);
    }
  }
  if (aula.publicacao) {
    const publico = card(raiz, "Planejamento de publicação com o professor");
    elemento(
      publico,
      "p",
      "Os testes desta unidade verificam configuração, logs e o fluxo local. A publicação requer uma prática acompanhada em um provedor.",
    );
    const lista = elemento(publico, "ul", undefined, "objetivos");
    aula.publicacao.forEach((texto) => elemento(lista, "li", texto));
  }
  const fontes = elemento(raiz, "details", undefined, "card");
  elemento(fontes, "summary", "Documentação para aprofundar");
  for (const fonte of aula.fontes) {
    const p = elemento(fontes, "p");
    const link = elemento(p, "a", fonte.titulo);
    link.href = fonte.url;
    link.target = "_blank";
    link.rel = "noreferrer";
  }
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

function sincronizarCores() {
  const espelho = $("codigo-colorido");
  espelho.innerHTML = colorirJS($("editor").value + "\n");
  espelho.scrollTop = $("editor").scrollTop;
  espelho.scrollLeft = $("editor").scrollLeft;
}
function contagemLinhas() {
  sincronizarCores();
  $("linhas").textContent = Array.from(
    { length: $("editor").value.split("\n").length },
    (_, i) => i + 1,
  ).join("\n");
}
function sincronizarEditor() {
  if (!aula) {
    return;
  }
  if (modoDemo) {
    return;
  }
  if (aula.modo === "funcoes") {
    respostas.codigos[aula.exercicios[exercicioAtual].id] = $("editor").value;
  } else {
    const arquivo = aula.projeto.arquivos.find((item) => item.nome === arquivoAtual);
    if (arquivo.editavel) {
      respostas.arquivos[arquivoAtual] = $("editor").value;
    }
  }
}
async function salvar() {
  clearTimeout(timer);
  if (!aula) {
    return;
  }
  sincronizarEditor();
  const versao = revisao;
  const id = aula.id;
  $("salvo").textContent = "Salvando…";
  await api("/api/salvar", comDados());
  if (id === aula.id && versao === revisao) {
    $("salvo").textContent = "Salvo localmente";
  }
}
function renderizarEditor() {
  if (aula.modo === "funcoes") {
    const exercicio = aula.exercicios[exercicioAtual];
    $("editor").value = respostas.codigos[exercicio.id];
    $("editor").readOnly = ocupado;
    $("nome-editor").textContent = exercicio.id + ".js";
    $("enunciado").textContent = exercicio.enunciado;
    renderizarBriefing(exercicio);
  } else {
    const arquivo = aula.projeto.arquivos.find((item) => item.nome === arquivoAtual);
    $("arquivo").value = arquivoAtual;
    $("editor").value = modoDemo
      ? aula.professor.solucaoProjeto[arquivoAtual]
      : respostas.arquivos[arquivoAtual];
    $("editor").readOnly = modoDemo || !arquivo.editavel || ocupado;
    $("nome-editor").textContent = arquivoAtual;
    $("enunciado").textContent = aula.desafio;
    renderizarBriefing();
    $("permissao").textContent = modoDemo
      ? "Referência da demonstração · leitura"
      : arquivo.editavel
        ? "Arquivo editável nesta etapa"
        : "Apoio disponível para leitura";
  }
  $("editor").scrollTop = 0;
  $("salvo").textContent = "Pronto para editar";
  contagemLinhas();
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
      elemento(detalhe, "p", "Execute a verificação para observar o comportamento.");
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
  $("pratica-titulo").textContent =
    aula.modo === "funcoes"
      ? "Resolva um desafio de cada vez"
      : "Sua missão nesta etapa da loja";
  $("pratica-descricao").textContent =
    aula.modo === "funcoes"
      ? "Leia o desafio ao lado, construa sua ideia e execute com seus próprios dados. Verifique os critérios quando estiver pronto."
      : "Edite os pontos desta etapa e observe o programa executando seus próprios arquivos.";
  let contrato = $("contrato-pratica");
  if (!contrato) {
    contrato = document.createElement("details");
    contrato.id = "contrato-pratica";
    contrato.className = "card";
    $("arquivos").before(contrato);
  }
  contrato.hidden = true;
  contrato.replaceChildren();
  if (aula.tarefas) {
    elemento(contrato, "summary", "O que implementar nesta etapa");
    for (const tarefa of aula.tarefas) {
      elemento(contrato, "h3", tarefa.titulo);
      elemento(contrato, "p", tarefa.texto);
    }
  }
  $("exercicios").replaceChildren();
  if (aula.modo === "funcoes") {
    aula.exercicios.forEach((exercicio, indice) => {
      const b = botao(
        $("exercicios"),
        `${indice + 1}. ${exercicio.nivel ? exercicio.nivel + " · " : ""}${exercicio.titulo}`,
        async () => {
          await salvar();
          exercicioAtual = indice;
          renderizarPratica();
        },
      );
      b.setAttribute("aria-current", String(indice === exercicioAtual));
    });
  }
  if (aula.missoes?.length) {
    aula.missoes.forEach((missao, indice) => {
      const observado = respostas.experimentos?.[missao.id] === "observado";
      const b = botao(
        $("exercicios"),
        `${indice + 1}. ${missao.nivel} · ${missao.titulo}${observado ? " · observado" : ""}`,
        async () => {
          await salvar();
          missaoAtual = indice;
          renderizarPratica();
        },
      );
      b.setAttribute("aria-current", String(indice === missaoAtual));
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
  $("testar").textContent = "Verificar desafio";
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

async function abrirAula(id) {
  if (ocupado) {
    return;
  }
  await salvar();
  if (apiAtiva && aula) {
    await api("/api/projeto/parar", { aulaId: aula.id });
  }
  document.body.classList.remove("no-estudio");
  $("estudio").hidden = true;
  const dados = await api("/api/aula?aula=" + encodeURIComponent(id));
  aula = dados.aula;
  respostas = dados.respostas;
  respostas.experimentos ??= {};
  resultados = [];
  exercicioAtual = 0;
  missaoAtual = 0;
  arquivoAtual = aula.projeto?.arquivoInicial;
  apiAtiva = false;
  apiDesatualizada = false;
  sessao = undefined;
  modoDemo = false;
  $("retomar").hidden = true;
  $("titulo").textContent = aula.titulo;
  $("etiqueta").textContent =
    `AULA ${String(aula.numero).padStart(2, "0")} · ${aula.modo === "projeto" ? "PROJETO DA LOJA" : "FUNDAMENTOS"}`;
  $("contexto").textContent = aula.contexto;
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
  mostrarAba(perfil === "professor" ? "preparar" : "estudar");
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
    $(id).disabled = valor;
  }
  $("editor").readOnly =
    valor ||
    modoDemo ||
    (aula.modo === "projeto" &&
      !aula.projeto.arquivos.find((a) => a.nome === arquivoAtual).editavel);
  $("testar").disabled = valor || modoDemo;
  $("recomecar").disabled = valor || modoDemo;
}
async function testar(todos = false) {
  if (ocupado) {
    return;
  }
  if (modoDemo) {
    throw new Error("Use Retomar atividade para verificar o código da tentativa.");
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
  await salvar();
  bloquear(true);
  aviso("Iniciando a aplicação da loja…");
  try {
    const retorno = await api("/api/projeto/iniciar", comDados({ demonstracao }));
    apiAtiva = true;
    apiDesatualizada = false;
    modoDemo = demonstracao;
    $("retomar").hidden = !modoDemo;
    renderizarEditor();
    $("estado-projeto").textContent =
      `Servidor real disponível em ${retorno.base}. ${demonstracao ? "Demonstração com a implementação de referência." : "Está executando seus arquivos."}`;
    $("badge-projeto").textContent = demonstracao ? "Demonstração" : "Em execução";
    $("logs").textContent =
      retorno.logs.join("\n") || "Nenhuma mensagem emitida pela aplicação.";
    mostrarAba("praticar");
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
  const arquivo = await api("/api/exportar-aula?aula=" + aula.id, undefined, true);
  baixar(arquivo, aula.id + ".aula-acai");
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
});
$("editor").oninput = () => {
  sincronizarEditor();
  revisao++;
  contagemLinhas();
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
  $("salvo").textContent = "Alterações pendentes";
  clearTimeout(timer);
  timer = setTimeout(
    () => salvar().catch((e) => aviso("Falha ao salvar: " + e.message, true)),
    500,
  );
};
$("editor").onscroll = () => {
  sincronizarCores();
  $("linhas").scrollTop = $("editor").scrollTop;
};
$("editor").onkeydown = (e) => {
  if (e.key === "Tab" && !$("editor").readOnly) {
    e.preventDefault();
    $("editor").setRangeText(
      "  ",
      $("editor").selectionStart,
      $("editor").selectionEnd,
      "end",
    );
    $("editor").dispatchEvent(new Event("input"));
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    tratar(() => testar(false))();
  }
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
    $("arquivo-gerado").querySelector("pre").textContent = retorno.arquivoGerado;
  }
});
$("modelo-request").onchange = preencherRequest;
$("enviar-request").onclick = tratar(async () => {
  if (!apiAtiva) {
    throw new Error("Clique em Executar projeto antes de enviar a requisição.");
  }
  if (apiDesatualizada) {
    throw new Error("Reexecute o projeto para aplicar as alterações do editor.");
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
    throw new Error("Execute o projeto com o código atual antes de chamar o cliente.");
  }
  const retorno = await api("/api/projeto/cliente", {
    aulaId: aula.id,
    token: sessao,
  });
  $("resposta-http").textContent = fmt(retorno.valor);
  $("status-http").textContent =
    "Resultado de cliente.cjs após consultar a própria API";
});
$("consultar-banco").onclick = tratar(async () => {
  const retorno = await api("/api/projeto/sql", {
    aulaId: aula.id,
    sql: $("consulta").value,
  });
  const root = $("tabela-banco");
  root.replaceChildren();
  elemento(root, "p", `${retorno.linhas.length} linha(s) retornada(s).`, "secondary");
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
  $("editor").value =
    aula.modo === "funcoes"
      ? aula.exercicios[exercicioAtual].codigoInicial
      : aula.projeto.arquivos.find((a) => a.nome === arquivoAtual).codigo;
  $("editor").dispatchEvent(new Event("input"));
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
  const arquivo = $("arquivo-importado").files[0];
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
    aviso("Respostas carregadas. Rode os testes para conferir a implementação.");
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
    $("editor").value = (await arquivo.text()).replace(/^\uFEFF/, "");
    $("editor").dispatchEvent(new Event("input"));
  }
  $("js-importado").value = "";
});
$("liberar").onclick = tratar(baixarAula);
$("motor").onclick = tratar(baixarMotor);
$("previa").onclick = () => window.open("/?visao=aluno&aula=" + aula.id, "_blank");
$("ajuda").onclick = () => {
  $("ajuda-texto").replaceChildren();
  const textos =
    perfil === "professor"
      ? [
          "Escolha a aula na biblioteca e acompanhe Preparar aula, Estudar e Praticar.",
          "Envie o aplicativo do aluno uma vez. Depois use Baixar esta aula e envie apenas o arquivo .aula-acai.",
          "A prévia projeta o conteúdo do aluno. A referência e o catálogo completo ficam no seu painel.",
        ]
      : [
          "Use Importar arquivo para abrir a aula liberada pelo professor.",
          "Acompanhe Estudar e depois abra Desafios e código. O código fica salvo neste motor.",
          "Envie as respostas com Baixar respostas. Você pode importar esse mesmo arquivo para recuperar seu trabalho.",
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
    "Suas respostas foram salvas. Para voltar, abra ABRIR.cmd.",
  );
});

async function carregarInicio(preferida) {
  const dados = await api(
    "/api/inicio" +
      (previa ? "?aula=" + encodeURIComponent(parametros.get("aula")) : ""),
  );
  perfil = dados.perfil;
  biblioteca = dados.aulas;
  $("perfil").textContent = perfil === "professor" ? "Professor" : "Aluno";
  $("motor").hidden = perfil !== "professor";
  $("acoes-professor").hidden = perfil !== "professor";
  $("aba-preparar").hidden = perfil !== "professor";
  $("aba-corrigir").hidden = perfil !== "professor";
  $("painel-professor").hidden = perfil !== "professor";
  $("nota-biblioteca").textContent =
    perfil === "professor"
      ? `${biblioteca.length} aulas. Use o painel para criar, revisar e liberar desafios.`
      : "Aqui aparecem apenas as aulas já liberadas neste motor.";
  const ultimo =
    preferida ??
    (previa ? parametros.get("aula") : localStorage.getItem("ultima-aula-" + perfil));
  const id = biblioteca.some((item) => item.id === ultimo)
    ? ultimo
    : (biblioteca.find((item) => item.numero === 12)?.id ?? biblioteca[0]?.id);
  if (!id) {
    throw new Error("Importe o arquivo de uma aula para começar.");
  }
  await abrirAula(id);
  if (perfil === "professor" && !preferida && typeof abrirEstudio === "function") {
    await abrirEstudio();
  }
}
const inicioCarregado = carregarInicio().catch((erro) =>
  aviso(erro.message + " Abra o laboratório pelo aplicativo.", true),
);

function renderizarBriefing(exercicio) {
  const missao = aula.missoes?.[missaoAtual];
  $("desafio-nome").textContent = exercicio?.titulo ?? missao?.titulo ?? aula.titulo;
  if (missao) {
    $("enunciado").textContent = missao.enunciado;
  }
  const dados = $("dados-desafio");
  dados.replaceChildren();
  elemento(dados, "h4", "Por que isso existe");
  elemento(dados, "p", aula.contexto);
  if (exercicio?.nivel) {
    elemento(dados, "p", exercicio.nivel, "tag");
  }
  if (missao) {
    elemento(dados, "h4", "O que observar");
    elemento(dados, "p", missao.observar);
    elemento(
      dados,
      "p",
      "Missão " +
        (missaoAtual + 1) +
        " de " +
        aula.missoes.length +
        " · observação manual, separada dos testes.",
      "secondary",
    );
    botao(
      dados,
      respostas.experimentos?.[missao.id] === "observado"
        ? "Retomar observação"
        : "Registrei a observação",
      async () => {
        respostas.experimentos ??= {};
        respostas.experimentos[missao.id] =
          respostas.experimentos[missao.id] === "observado" ? "" : "observado";
        await salvar();
        renderizarPratica();
      },
    );
  }
  if (exercicio) {
    const teste = exercicio.testes[0];
    elemento(dados, "h4", "Exemplo de uso");
    elemento(dados, "pre", teste.executar, "code");
    elemento(
      dados,
      "h4",
      Object.hasOwn(teste, "erroEsperado") ? "Erro esperado" : "Resultado esperado",
    );
    elemento(
      dados,
      "pre",
      Object.hasOwn(teste, "erroEsperado") ? teste.erroEsperado : fmt(teste.esperado),
      "console",
    );
    elemento(dados, "h4", "A solução precisa atender");
    const lista = elemento(dados, "ul");
    exercicio.testes.forEach((t) => elemento(lista, "li", t.nome));
    const chave = exercicio.id;
    respostas.experimentos ??= {};
    if (respostas.experimentos[chave] === undefined) {
      respostas.experimentos[chave] =
        exercicio.experimento ??
        "const resultado = await (async () => {\n" +
          teste.executar +
          "\n})();\nconsole.log(resultado);";
    }
    $("rascunho").value = respostas.experimentos[chave];
    $("modo-experimento").value = "desafio";
    $("console-livre").textContent =
      "Escreva sua hipótese e execute. Isso não verifica nem aprova testes.";
  } else {
    elemento(dados, "h4", "Arquivos desta etapa");
    aula.projeto.arquivos.forEach((f) =>
      elemento(
        dados,
        "p",
        f.nome + " · " + (f.editavel ? "você implementa" : "apoio para leitura"),
      ),
    );
    if (aula.tarefas?.length) {
      const contrato = elemento(dados, "details");
      elemento(contrato, "summary", "Contrato completo da etapa");
      for (const t of aula.tarefas) {
        elemento(contrato, "h4", t.titulo);
        elemento(contrato, "p", t.texto);
      }
    }
    elemento(dados, "h4", "Como experimentar");
    elemento(
      dados,
      "p",
      aula.projeto.tipo === "http"
        ? "Execute o projeto, envie suas requisições e observe a resposta real. Os testes são uma ação separada."
        : "Edite os arquivos e execute um dos comandos no terminal abaixo. Confira o console e o arquivo gerado antes dos testes.",
    );
  }
  const navegacao = elemento(dados, "div", undefined, "grupo");
  const indice = exercicio ? exercicioAtual : missaoAtual;
  const total = exercicio ? aula.exercicios.length : (aula.missoes?.length ?? 1);
  elemento(
    dados,
    "p",
    `${exercicio ? "Desafio" : "Missão"} ${indice + 1} de ${total}`,
    "secondary",
  );
  if (indice > 0) {
    botao(navegacao, "← Anterior", async () => {
      await salvar();
      if (exercicio) {
        exercicioAtual--;
      } else {
        missaoAtual--;
      }
      renderizarPratica();
    });
  }
  if (indice < total - 1) {
    botao(navegacao, "Próximo →", async () => {
      await salvar();
      if (exercicio) {
        exercicioAtual++;
      } else {
        missaoAtual++;
      }
      renderizarPratica();
    });
  }
  const pistas = $("pistas-desafio");
  pistas.replaceChildren();
  for (const p of aula.construcao) {
    elemento(pistas, "strong", p.titulo);
    elemento(pistas, "p", p.texto);
  }
}
$("voltar-conceito").onclick = () => mostrarAba("estudar");
$("rascunho").oninput = () => {
  if (aula?.modo !== "funcoes") {
    return;
  }
  respostas.experimentos[aula.exercicios[exercicioAtual].id] = $("rascunho").value;
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
      ($("modo-experimento").value === "desafio" ? $("editor").value + "\n;\n" : "") +
      $("rascunho").value;
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
  window.laboratorioDesktop.aoAbrirAula(
    tratar(async (dado) => {
      await inicioCarregado;
      if (perfil !== "aluno") {
        throw new Error("Abra este arquivo na edição Aluno.");
      }
      const retorno = await api("/api/importar-aula", dado);
      await carregarInicio(retorno.id);
      aviso("Aula aberta. Comece pela explicação.");
    }),
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
