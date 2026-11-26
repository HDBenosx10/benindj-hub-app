"use strict";
(function (raiz) {
  const tecnicasDisponiveis = {
    arrow: "Arrow function",
    declaracao: "Declaração function",
    expressao: "Expressão function",
    for: "Laço for",
    "for-of": "Laço for…of",
    while: "Laço while",
    "do-while": "Laço do…while",
    laco: "Um laço de repetição",
    "lacos-aninhados": "Laços aninhados",
    "sem-metodo-reverse": "Não chamar .reverse",
    recursao: "Chamada recursiva direta",
    async: "Função async",
    await: "Expressão await",
    "try-catch": "Bloco try com catch",
    finally: "Bloco finally",
    "arrow-interna": "Arrow interna declarada e chamada",
    "arrow-interna-expressao":
      "Arrow interna chamada, com retorno de expressão",
    "arrow-interna-bloco": "Arrow interna chamada, com corpo em bloco",
    "metodo-map": "Chamada direta de .map",
    "metodo-filter": "Chamada direta de .filter",
    "metodo-find": "Chamada direta de .find",
    "metodo-reduce": "Chamada direta de .reduce",
    "metodo-some": "Chamada direta de .some",
    "metodo-every": "Chamada direta de .every",
    "metodo-catch": "Chamada direta de .catch",
  };
  function validarTecnica(t) {
    if (
      !t ||
      t.versao !== 1 ||
      typeof t.funcao !== "string" ||
      !/^[A-Za-z_$][\w$]{0,60}$/.test(t.funcao) ||
      !Object.hasOwn(tecnicasDisponiveis, t.regra) ||
      Object.keys(t).some((k) => !["versao", "funcao", "regra"].includes(k))
    )
      throw Error(
        "Requisito técnico inválido: informe a função e uma técnica suportada.",
      );
    return t;
  }
  function validarContrato(c) {
    if (c === undefined) return;
    const texto = (s) =>
      typeof s === "string" && s.trim().length > 0 && s.length <= 30000;
    if (
      !c ||
      c.versao !== 1 ||
      (c.descricao !== undefined &&
        (!Array.isArray(c.descricao) ||
          !c.descricao.length ||
          !c.descricao.every(texto))) ||
      !Array.isArray(c.assinaturas) ||
      !c.assinaturas.every(texto) ||
      !Array.isArray(c.parametros) ||
      !c.parametros.every(
        (p) => p && texto(p.nome) && texto(p.tipo) && texto(p.descricao),
      ) ||
      !c.retorno ||
      !texto(c.retorno.tipo) ||
      !texto(c.retorno.descricao) ||
      !Array.isArray(c.regras) ||
      !c.regras.every(texto) ||
      !Array.isArray(c.exemplos) ||
      !c.exemplos.length ||
      !c.exemplos.every(
        (e) => e && texto(e.entrada) && texto(e.saida) && texto(e.explicacao),
      ) ||
      !Array.isArray(c.guia) ||
      !c.guia.length ||
      !c.guia.every((p) => p && texto(p.titulo) && texto(p.texto))
    )
      throw Error(
        "Preencha o contrato da atividade: assinatura, parâmetros, saída, regras, exemplos de entrada/saída e prática guiada.",
      );
  }
  function validar(aula) {
    if (
      aula.preRequisitosTexto !== undefined &&
      typeof aula.preRequisitosTexto !== "string"
    )
      throw Error("Descreva os pré-requisitos como texto.");
    if (
      aula.revisao !== undefined &&
      (!aula.revisao ||
        ["previsao", "diagnostico", "transferencia"].some(
          (campo) =>
            typeof aula.revisao[campo] !== "string" ||
            !aula.revisao[campo].trim(),
        ))
    )
      throw Error(
        "A revisão precisa de previsão, dificuldade de diagnóstico e tarefa de transferência.",
      );
    if (
      aula.estudo !== undefined &&
      (!Array.isArray(aula.estudo) ||
        !aula.estudo.length ||
        aula.estudo.some(
          (s) =>
            !s?.titulo ||
            !Array.isArray(s.paragrafos) ||
            !s.paragrafos.length ||
            s.paragrafos.some((p) => typeof p !== "string" || !p.trim()),
        ))
    )
      throw Error("O estudo precisa de seções com título e explicações.");
    for (const a of [...(aula.exercicios ?? []), ...(aula.missoes ?? [])])
      validarContrato(a.contrato);
    for (const e of aula.exercicios ?? [])
      for (const t of e.testes ?? []) {
        if (t.tecnica === undefined) continue;
        validarTecnica(t.tecnica);
        if (
          t.executar !== "return true;" ||
          t.esperado !== true ||
          Object.hasOwn(t, "erroEsperado")
        )
          throw Error(
            "O caso técnico deve usar executar return true; e esperado true; os testes de comportamento ficam separados.",
          );
        if (!e.testes.some((caso) => caso.tecnica === undefined))
          throw Error(
            "Inclua também testes de comportamento: somente a técnica não comprova a solução.",
          );
      }
  }
  function contrato(atividade) {
    if (atividade?.contrato) return atividade.contrato;
    // Aulas antigas continuam utilizáveis, sem apresentar o corpo de um teste
    // como se ele fosse uma entrada ou uma implementação de referência.
    return {
      versao: 1,
      legado: true,
      assinaturas: [],
      parametros: [],
      retorno: null,
      regras: [],
      exemplos: [],
      guia: [],
    };
  }
  function estudo(aula) {
    return (
      aula.estudo ??
      (aula.conceitos ?? []).map((p, i) => ({
        titulo: "Conceito " + (i + 1),
        paragrafos: [p],
      }))
    );
  }
  const api = {
    validar,
    validarContrato,
    contrato,
    estudo,
    validarTecnica,
    tecnicasDisponiveis,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.HubConteudo = api;
})(typeof window === "undefined" ? globalThis : window);
