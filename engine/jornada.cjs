"use strict";
const { createHash } = require("node:crypto");
const trilhas = [
  {
    id: "backend",
    nome: "Back-end",
    estado: "disponivel",
    descricao: "Regras, APIs, dados e integrações com JavaScript.",
  },
  {
    id: "frontend",
    nome: "Front-end",
    estado: "planejada",
    descricao:
      "Interfaces, acessibilidade e aplicações no navegador. Conteúdo específico em preparação.",
  },
  {
    id: "ia",
    nome: "Inteligência artificial",
    estado: "planejada",
    descricao:
      "Dados, avaliação e integração de modelos. Conteúdo específico em preparação.",
  },
];
const linguagens = [
  { id: "javascript", nome: "JavaScript", disponivel: true },
  { id: "java", nome: "Java", disponivel: false },
  { id: "go", nome: "Go", disponivel: false },
];
function validarEscolha(dado) {
  if (!trilhas.some((t) => t.id === dado.trilha))
    throw Error("Escolha uma trilha válida.");
  if (dado.linguagem !== "javascript")
    throw Error(
      "Java e Go estão previstos para a V2. O runtime atual executa JavaScript.",
    );
  return {
    trilha: dado.trilha,
    linguagem: "javascript",
    escolhidaEm: new Date().toISOString(),
  };
}
function trilhaDaAula(aula) {
  if (
    aula.trilha &&
    ["comum", ...trilhas.map((t) => t.id)].includes(aula.trilha)
  )
    return aula.trilha;
  return aula.numero <= 34 ? "comum" : "backend";
}
function assinatura(aula, salvo, id) {
  const exercicio = aula.exercicios?.find((e) => e.id === id);
  const valor = exercicio
    ? [exercicio, salvo.codigos?.[id], aula.ambiente]
    : [aula.projeto, aula.testes, aula.ambiente, salvo.arquivos];
  return createHash("sha256").update(JSON.stringify(valor)).digest("hex");
}
function resumo(aula, salvo = {}) {
  const ids =
    aula.modo === "funcoes" ? aula.exercicios.map((e) => e.id) : ["projeto"];
  const concluidos = ids.filter(
    (id) => salvo.progresso?.[id] === assinatura(aula, salvo, id),
  ).length;
  return {
    concluidos,
    total: ids.length,
    percentual: ids.length ? Math.round((concluidos / ids.length) * 100) : 0,
    completa: ids.length > 0 && concluidos === ids.length,
  };
}
function registrar(aula, salvo, resultados, exercicioId) {
  salvo.progresso ??= {};
  const ids =
    aula.modo === "funcoes"
      ? aula.exercicios
          .filter((e) => !exercicioId || e.id === exercicioId)
          .map((e) => e.id)
      : ["projeto"];
  for (const id of ids) {
    const itens =
      aula.modo === "funcoes"
        ? resultados.filter((r) => r.exercicioId === id)
        : resultados;
    const esperado =
      aula.modo === "funcoes"
        ? aula.exercicios.find((e) => e.id === id).testes.length
        : aula.projeto.testes.length;
    if (
      itens.length === esperado &&
      esperado > 0 &&
      itens.every((r) => r.passou)
    )
      salvo.progresso[id] = assinatura(aula, salvo, id);
    else delete salvo.progresso[id];
  }
  return resumo(aula, salvo);
}
module.exports = {
  trilhas,
  linguagens,
  validarEscolha,
  trilhaDaAula,
  resumo,
  registrar,
};
