"use strict";
const { createHash } = require("node:crypto");
const trilhas = [
  {
    id: "backend",
    nome: "Back-end",
    estado: "disponivel",
    descricao: "Interesse em regras de negócio, APIs, dados e integrações.",
  },
  {
    id: "frontend",
    nome: "Front-end",
    estado: "planejada",
    descricao:
      "Interesse em interfaces, acessibilidade e aplicações no navegador.",
  },
  {
    id: "ia",
    nome: "Inteligência artificial",
    estado: "planejada",
    descricao: "Interesse em dados, avaliação e integração de modelos.",
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
    ...(typeof dado.percursoId === "string" &&
    /^percurso-[a-f0-9-]{36}$/.test(dado.percursoId)
      ? { percursoId: dado.percursoId }
      : {}),
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
  // A reorganização do material de leitura não muda os critérios já aprovados.
  const regra =
    exercicio &&
    Object.fromEntries(
      Object.entries(exercicio).filter(([campo]) => campo !== "contrato"),
    );
  const valor = exercicio
    ? [regra, salvo.codigos?.[id], aula.ambiente]
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
    revalidar: ids.filter((id) => salvo.progresso?.[id] && salvo.progresso[id] !== assinatura(aula, salvo, id)).length,
    aprovadas: ids.filter(id => salvo.progresso?.[id] === assinatura(aula, salvo, id)),
    revalidacoes: ids.filter(id => salvo.progresso?.[id] && salvo.progresso[id] !== assinatura(aula, salvo, id)),
  };
}
function preservarAprovacoes(anterior, nova, salvo) {
  if (anterior.modo !== nova.modo || !salvo?.progresso) return false;
  if (JSON.stringify(anterior.ambiente) !== JSON.stringify(nova.ambiente))
    return false;
  // O nome do cenário é apresentação; todos os outros campos podem afetar a avaliação.
  const criterios = (testes) => JSON.stringify(testes.map(({ nome, ...regra }) => regra));
  if (anterior.modo === "projeto") {
    const contrato = (aula) => {
      const { testes, arquivos, requisicoes, titulo, descricao, ...config } = aula.projeto;
      return JSON.stringify({
        config,
        testes: criterios(testes),
        testesAdicionais: aula.testes,
        // Arquivos de apoio podem mudar o comportamento mesmo sem alterar os testes.
        arquivos: arquivos.map(({ nome, editavel, codigo }) => ({ nome, editavel, ...(!editavel ? { codigo } : {}) })),
      });
    };
    if (contrato(anterior) !== contrato(nova) || salvo.progresso.projeto !== assinatura(anterior, salvo, "projeto")) return false;
    const novoHash = assinatura(nova, salvo, "projeto");
    if (novoHash === salvo.progresso.projeto) return false;
    salvo.progresso.projeto = novoHash;
    return true;
  }
  let mudou = false;
  for (const e of anterior.exercicios) {
    const atual = nova.exercicios.find((item) => item.id === e.id);
    if (
      atual &&
      criterios(e.testes) === criterios(atual.testes) &&
      salvo.progresso[e.id] === assinatura(anterior, salvo, e.id)
    ) {
      const novoHash = assinatura(nova, salvo, e.id);
      if (novoHash !== salvo.progresso[e.id]) {
        salvo.progresso[e.id] = novoHash;
        mudou = true;
      }
    }
  }
  return mudou;
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
function posicao(aula, salvo = {}) {
  const p = resumo(aula, salvo),
    s = salvo.estudo ?? {};
  const atividades =
    aula.modo === "funcoes" ? aula.exercicios : (aula.missoes ?? []);
  const indice = atividades.findIndex((e) => e.id === s.atividadeId);
  const primeiroPendente =
    aula.modo === "funcoes"
      ? atividades.findIndex(
          (e) => salvo.progresso?.[e.id] !== assinatura(aula, salvo, e.id),
        )
      : 0;
  const atual = indice >= 0 ? indice : Math.max(0, primeiroPendente);
  const mudou =
    (aula.exercicios ?? []).some(
      (e) =>
        typeof salvo.codigos?.[e.id] === "string" &&
        salvo.codigos[e.id] !== e.codigoInicial,
    ) ||
    (aula.projeto?.arquivos ?? []).some(
      (f) =>
        f.editavel &&
        typeof salvo.arquivos?.[f.nome] === "string" &&
        salvo.arquivos[f.nome] !== f.codigo,
    );
  return {
    iniciada: !!s.iniciadaEm || mudou || p.concluidos > 0,
    iniciadaEm: s.iniciadaEm ?? null,
    atualizadaEm: s.atualizadaEm ?? null,
    aba: s.aba ?? "estudar",
    atividadeId: atividades[atual]?.id ?? null,
    atividadeTitulo: atividades[atual]?.titulo ?? null,
    indiceAtividade: atual,
    totalAtividades: atividades.length,
    arquivo: s.arquivo ?? aula.projeto?.arquivoInicial ?? null,
  };
}
function registrarEstudo(
  aula,
  salvo,
  dado = {},
  agora = new Date().toISOString(),
) {
  const atual = posicao(aula, salvo),
    atividades =
      aula.modo === "funcoes" ? aula.exercicios : (aula.missoes ?? []);
  salvo.estudo = {
    iniciadaEm: salvo.estudo?.iniciadaEm ?? agora,
    atualizadaEm: agora,
    aba: ["estudar", "praticar", "ambiente", "transferencia"].includes(dado.aba)
      ? dado.aba
      : atual.aba,
    atividadeId: atividades.some((e) => e.id === dado.atividadeId)
      ? dado.atividadeId
      : atual.atividadeId,
    arquivo: aula.projeto?.arquivos.some((f) => f.nome === dado.arquivo)
      ? dado.arquivo
      : atual.arquivo,
  };
  return posicao(aula, salvo);
}
module.exports = {
  preservarAprovacoes,
  trilhas,
  linguagens,
  validarEscolha,
  trilhaDaAula,
  resumo,
  registrar,
  posicao,
  registrarEstudo,
};
