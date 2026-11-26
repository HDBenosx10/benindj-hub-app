"use strict";
let ultimaAulaDeLeitura;
function configurarLeitura(aberta) {
  $("leitura-conteudo").hidden = !aberta;
  $("briefing").classList.toggle("recolhido", !aberta);
  $("briefing").parentElement.classList.toggle("leitura-recolhida", !aberta);
  $("leitura-toggle").setAttribute("aria-expanded", String(aberta));
  $("leitura-toggle").title = aberta
    ? "Recolher enunciado"
    : "Abrir enunciado da atividade";
  $("leitura-toggle").querySelector(".leitura-chevron").textContent = aberta
    ? "‹"
    : "›";
}
document.getElementById("leitura-toggle").onclick = () =>
  configurarLeitura($("leitura-conteudo").hidden);
function secaoDeLeitura(raiz, titulo, aberta = true) {
  const secao = elemento(raiz, "details", undefined, "secao-leitura");
  secao.open = aberta;
  elemento(secao, "summary", titulo);
  return secao;
}
function renderizarEstudo() {
  const raiz = $("estudar");
  raiz.replaceChildren();
  const artigo = elemento(raiz, "article", undefined, "aula-artigo");
  elemento(artigo, "h2", "O que vamos compreender");
  elemento(artigo, "p", aula.contexto, "aula-contexto");
  if (aula.preRequisitosTexto)
    elemento(
      artigo,
      "p",
      "Antes de começar: " + aula.preRequisitosTexto,
      "aula-previos",
    );
  const texto = secaoDeLeitura(artigo, "Ler a explicação", true);
  texto.classList.add("texto-aula");
  for (const secao of HubConteudo.estudo(aula)) {
    const bloco = elemento(texto, "section", undefined, "conceito-aula");
    elemento(bloco, "h3", secao.titulo);
    secao.paragrafos.forEach((p) => elemento(bloco, "p", p));
    if (secao.exemplo)
      elemento(
        bloco,
        "pre",
        secao.exemplo,
        secao.linguagem === "sql" ? "code sql-example" : "code",
      );
  }
  if (aula.exemplo) {
    const exemplo = elemento(texto, "section", undefined, "exemplo-aula");
    elemento(exemplo, "h3", "Um exemplo acompanhado");
    elemento(
      exemplo,
      "pre",
      aula.exemplo,
      /^\s*(--|SELECT|CREATE)/i.test(aula.exemplo)
        ? "code sql-example"
        : "code",
    );
    for (const p of aula.exemploExplicado ?? []) elemento(exemplo, "p", p);
  }
  if (aula.revisao) {
    const revisao = secaoDeLeitura(
      artigo,
      "Confira se você consegue explicar",
      false,
    );
    elemento(revisao, "p", aula.revisao.previsao);
    elemento(
      revisao,
      "p",
      "Uma dificuldade para investigar: " + aula.revisao.diagnostico,
    );
    elemento(revisao, "p", aula.revisao.transferencia);
  }
  const atividades = aula.modo === "funcoes" ? aula.exercicios : aula.missoes;
  elemento(
    artigo,
    "p",
    `${atividades.length} atividades nesta aula. Você pode distribuir a prática em mais de um encontro.`,
    "secondary",
  );
  botao(
    artigo,
    "Ir para as atividades →",
    () => mostrarAba("praticar"),
    "primary",
  );
  const percurso = secaoDeLeitura(artigo, "Ver o percurso de prática", false);
  atividades.forEach((atividade, indice) => {
    const linha = elemento(percurso, "div", undefined, "conceito-atividade");
    elemento(linha, "strong", `${indice + 1}. ${atividade.titulo}`);
    elemento(linha, "span", atividade.nivel ?? "Prática", "secondary");
    botao(
      linha,
      "Abrir atividade →",
      async () => {
        await salvar();
        if (aula.modo === "funcoes") exercicioAtual = indice;
        else missaoAtual = indice;
        renderizarPratica();
        mostrarAba("praticar");
      },
      "text-button",
    );
  });
  const fontes = secaoDeLeitura(artigo, "Aprofundar este assunto", false);
  elemento(
    fontes,
    "p",
    "A explicação acima contém a base para começar. As referências abaixo são consultas opcionais; leia o trecho indicado para esta aula.",
  );
  for (const fonte of aula.fontes ?? []) {
    const bloco = elemento(fontes, "div", undefined, "referencia-aula");
    const link = elemento(bloco, "a", fonte.titulo);
    link.href = fonte.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    if (fonte.orientacao) elemento(bloco, "p", fonte.orientacao);
  }
}

function renderizarBriefing(exercicio) {
  const missao = exercicio ? null : aula.missoes?.[missaoAtual];
  const atividade = exercicio ?? missao;
  const contrato = HubConteudo.contrato(atividade);
  if (ultimaAulaDeLeitura !== aula.id) {
    ultimaAulaDeLeitura = aula.id;
    configurarLeitura(true);
  }
  $("desafio-nome").textContent = atividade?.titulo ?? aula.titulo;
  $("enunciado").replaceChildren();
  (contrato.descricao ?? [atividade?.enunciado ?? aula.desafio]).forEach((p) =>
    elemento($("enunciado"), "p", p),
  );
  $("leitura-toggle").setAttribute(
    "aria-label",
    "Enunciado: " + $("desafio-nome").textContent,
  );
  const dados = $("dados-desafio");
  dados.replaceChildren();
  $("atividade-nivel").textContent = atividade?.nivel
    ? "SUA ATIVIDADE · " + atividade.nivel
    : "SUA ATIVIDADE";
  if (contrato.objetivo && contrato.objetivo !== atividade?.titulo)
    elemento(dados, "p", contrato.objetivo, "objetivo-atividade");
  if (contrato.assinaturas.length) {
    elemento(dados, "h4", "Como chamar a função · assinatura");
    elemento(
      dados,
      "p",
      "A assinatura mostra o nome da função e os nomes dos parâmetros entre parênteses. Parâmetros são os lugares que recebem os dados de cada chamada.",
      "ajuda-contrato",
    );
    contrato.assinaturas.forEach((s) => elemento(dados, "pre", s, "code"));
  }
  elemento(
    dados,
    "h4",
    exercicio
      ? "Entrada da função · parâmetros"
      : "Entrada do projeto · dados e ação",
  );
  if (exercicio && contrato.parametros.length)
    elemento(
      dados,
      "p",
      "Em uma chamada, os valores fornecidos são os argumentos. Eles correspondem aos parâmetros na ordem indicada abaixo.",
      "ajuda-contrato",
    );
  if (contrato.parametros.length)
    for (const p of contrato.parametros) {
      const parametro = elemento(
        dados,
        "div",
        undefined,
        "parametro-atividade",
      );
      elemento(parametro, "code", p.nome);
      const tipo = p.tipo
        .replace(/\bnumber\b/g, "número")
        .replace(/\bstring\b/g, "texto")
        .replace(/\bboolean\b/g, "booleano: true ou false")
        .replace(/\bArray\b/g, "lista");
      elemento(parametro, "span", "Tipo: " + tipo, "tipo-parametro");
      elemento(parametro, "p", p.descricao);
    }
  else
    elemento(
      dados,
      "p",
      contrato.semParametros ??
        (contrato.legado
          ? "Os dados e argumentos estão descritos no enunciado original desta aula."
          : "Esta atividade não recebe parâmetros de função."),
    );
  elemento(
    dados,
    "h4",
    exercicio
      ? aula.numero === 0
        ? "Saída no console"
        : "Resultado devolvido · return"
      : "Resposta ou efeito esperado",
  );
  if (contrato.retorno) {
    elemento(dados, "code", contrato.retorno.tipo, "tipo-retorno");
    elemento(dados, "p", contrato.retorno.descricao);
  } else
    elemento(
      dados,
      "p",
      "Consulte o retorno e os efeitos solicitados no enunciado. Esta aula foi importada no formato anterior.",
    );
  if (contrato.regras.length) {
    const regras = secaoDeLeitura(dados, "Regras e casos de fronteira");
    const lista = elemento(regras, "ul");
    contrato.regras.forEach((r) => elemento(lista, "li", r));
  }
  const tecnicas = (atividade?.testes ?? []).filter((t) => t.tecnica);
  if (tecnicas.length) {
    const requisitos = secaoDeLeitura(dados, "Técnica exigida nesta questão");
    const lista = elemento(requisitos, "ul");
    for (const t of tecnicas)
      elemento(
        lista,
        "li",
        `${t.tecnica.funcao}: ${HubConteudo.tecnicasDisponiveis[t.tecnica.regra]}.`,
      );
    elemento(
      requisitos,
      "p",
      "Verificar confere esta estrutura no código e também os testes de comportamento. Funções auxiliares não substituem a técnica pedida no corpo da função indicada.",
    );
  }
  contrato.exemplos.forEach((exemplo, indice) => {
    const bloco = secaoDeLeitura(dados, "Exemplo " + (indice + 1));
    elemento(
      bloco,
      "h4",
      exercicio && exemplo.chamada
        ? "Entrada · chamada com argumentos"
        : "Entrada · dados e ação",
    );
    elemento(bloco, "pre", exemplo.entrada, "code");
    if (exemplo.leitura)
      elemento(bloco, "p", exemplo.leitura, "leitura-argumentos");
    elemento(bloco, "h4", "Saída esperada");
    elemento(bloco, "pre", exemplo.saida, "code");
    elemento(bloco, "p", exemplo.explicacao);
    if (exercicio && exemplo.chamada)
      botao(
        bloco,
        "Usar esta entrada no rascunho",
        () => {
          if (painelDebug.ativo()) {
            aviso("Encerre o debugger para trocar as entradas.");
            return;
          }
          $("rascunho").value =
            "console.log(" +
            (aula.numero >= 31 ? "await " : "") +
            exemplo.chamada +
            ");";
          $("rascunho").dispatchEvent(new Event("input"));
          $("meus-experimentos").open = true;
          aviso(
            "Entrada copiada para o rascunho. Execute sua tentativa para investigar o resultado.",
          );
        },
        "text-button",
      );
  });
  const criterios = secaoDeLeitura(
    dados,
    missao
      ? "Como reconhecer que concluiu esta missão"
      : "Cenários verificados",
    false,
  );
  if (!exercicio) {
    elemento(criterios, "p", missao?.observar ?? aula.desafio);
    elemento(
      criterios,
      "p",
      "Esta missão registra uma observação. Verificar avalia os cenários do projeto completo.",
      "secondary",
    );
    if (missao)
      botao(
        criterios,
        respostas.experimentos?.[missao.id] === "observado"
          ? "Retomar observação"
          : "Registrei a observação",
        tratar(async () => {
          respostas.experimentos ??= {};
          respostas.experimentos[missao.id] =
            respostas.experimentos[missao.id] === "observado"
              ? ""
              : "observado";
          await salvar();
          renderizarPratica();
        }),
      );
    const arquivos = secaoDeLeitura(
      dados,
      "Arquivos e contrato do projeto",
      false,
    );
    for (const f of aula.projeto.arquivos)
      elemento(
        arquivos,
        "p",
        `${f.nome} · ${f.editavel ? "editável nesta etapa" : "apoio para leitura"}`,
      );
    for (const t of aula.tarefas ?? []) {
      elemento(arquivos, "h4", t.titulo);
      elemento(arquivos, "p", t.texto);
    }
  } else {
    const lista = elemento(criterios, "ul");
    (exercicio.testes ?? []).forEach((t) => elemento(lista, "li", t.nome));
    const chave = exercicio.id;
    respostas.experimentos ??= {};
    if (respostas.experimentos[chave] === undefined)
      respostas.experimentos[chave] = contrato.exemplos[0]?.chamada
        ? "console.log(" +
          (aula.numero >= 31 ? "await " : "") +
          contrato.exemplos[0].chamada +
          ");"
        : (exercicio.experimento ?? "");
    $("rascunho").value = respostas.experimentos[chave];
    $("modo-experimento").value = "desafio";
    $("meus-experimentos").hidden = exercicio.tipoExecucao === "script";
    $("console-livre").textContent =
      "Execute sua tentativa e compare com a saída esperada. Verificar confere os critérios separadamente.";
  }
  const guia = $("guia-desafio");
  guia.replaceChildren();
  for (const p of contrato.guia) {
    elemento(guia, "h4", p.titulo);
    elemento(guia, "p", p.texto);
  }
  if (!contrato.guia.length)
    elemento(
      guia,
      "p",
      atividade?.dica ?? atividade?.enunciado ?? aula.desafio,
    );
  if (
    aula.publicacao?.length &&
    missaoAtual === (aula.missoes?.length ?? 1) - 1
  ) {
    const planejamento = secaoDeLeitura(
      guia,
      "Planejamento de publicação com o professor",
      false,
    );
    elemento(
      planejamento,
      "p",
      "Esta atividade prepara um planejamento. A verificação da aula cobre o fluxo local; nenhuma publicação é feita pelo roteiro.",
    );
    const lista = elemento(planejamento, "ul");
    aula.publicacao.forEach((p) => elemento(lista, "li", p));
  }
  botao(
    guia,
    "Executar minha tentativa",
    () => {
      if (exercicio) $("run-livre").click();
      else if (aula.projeto.tipo === "http") $("executar-projeto").click();
      else {
        focarPratica("execucao");
        aviso(
          "Escolha o comando desta atividade no terminal de treino e execute sua tentativa.",
        );
      }
    },
    "primary",
  );
  const pistas = $("pistas-desafio");
  pistas.replaceChildren();
  for (const p of contrato.pistas ?? [
    atividade?.dica ??
      atividade?.observar ??
      "Compare a entrada e a saída esperada antes de escrever a solução.",
  ])
    elemento(pistas, "p", p);
  const indice = exercicio ? exercicioAtual : missaoAtual;
  const total = (aula.exercicios ?? aula.missoes ?? [atividade]).length;
  const navegacao = elemento(dados, "div", undefined, "navegacao-atividade");
  elemento(
    navegacao,
    "p",
    `${exercicio ? "Exercício" : "Missão"} ${indice + 1} de ${total}`,
    "secondary",
  );
  for (const [delta, texto] of [
    [-1, "← Anterior"],
    [1, "Próximo →"],
  ])
    if (indice + delta >= 0 && indice + delta < total)
      botao(
        navegacao,
        texto,
        tratar(async () => {
          await painelDebug.parar();
          await salvar();
          if (exercicio) exercicioAtual += delta;
          else missaoAtual += delta;
          renderizarPratica();
        }),
      );
}
