"use strict";
(function (raiz) {
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
  const api = { validar, validarContrato, contrato, estudo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.HubConteudo = api;
})(typeof window === "undefined" ? globalThis : window);
