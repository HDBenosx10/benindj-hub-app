(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HubPercurso = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const objetivos = ["backend", "frontend", "ia", "outro"];
  const ordenar = (lista) =>
    [...lista].sort(
      (a, b) =>
        (Number(a.numero) || 0) - (Number(b.numero) || 0) ||
        String(a.id).localeCompare(String(b.id)),
    );
  function validar(plano, ids) {
    if (
      !plano ||
      typeof plano.nome !== "string" ||
      !plano.nome.trim() ||
      plano.nome.length > 120 ||
      !objetivos.includes(plano.objetivo) ||
      plano.linguagem !== "javascript" ||
      !Array.isArray(plano.etapas) ||
      !plano.etapas.length ||
      plano.etapas.length > 100
    )
      throw Error(
        "Informe nome, objetivo, linguagem e de 1 a 100 aulas para a trilha.",
      );
    const vistos = new Set();
    const etapas = plano.etapas.map((e) => {
      if (
        !e ||
        !/^aula-\d{2}$/.test(e.aulaId) ||
        vistos.has(e.aulaId) ||
        !ids.includes(e.aulaId) ||
        typeof e.grupo !== "string" ||
        !e.grupo.trim() ||
        e.grupo.length > 120
      )
        throw Error(
          "Cada aula deve existir no acervo, aparecer uma vez e ter um grupo definido.",
        );
      vistos.add(e.aulaId);
      return { aulaId: e.aulaId, grupo: e.grupo.trim() };
    });
    return {
      nome: plano.nome.trim(),
      objetivo: plano.objetivo,
      linguagem: "javascript",
      etapas,
    };
  }
  function descrever(planos, aulaId) {
    return planos.flatMap((p) => {
      const ordem = p.etapas.findIndex((e) => e.aulaId === aulaId);
      return ordem < 0
        ? []
        : [
            {
              id: p.id,
              nome: p.nome,
              objetivo: p.objetivo,
              linguagem: p.linguagem,
              grupo: p.etapas[ordem].grupo,
              ordem,
            },
          ];
    });
  }
  function manifesto(plano, catalogo) {
    return validarManifesto({
      tipo: "trilha-hub",
      versao: 1,
      id: plano.id,
      nome: plano.nome,
      objetivo: plano.objetivo,
      linguagem: plano.linguagem,
      etapas: plano.etapas.map((e) => {
        const a = catalogo.find((a) => a.id === e.aulaId);
        if (!a)
          throw Error(
            "A aula " + e.aulaId + " não está mais no acervo. Revise a trilha.",
          );
        return {
          aulaId: a.id,
          numero: a.numero,
          titulo: a.titulo,
          grupo: e.grupo,
        };
      }),
    });
  }
  function validarManifesto(p) {
    if (
      !p ||
      p.tipo !== "trilha-hub" ||
      p.versao !== 1 ||
      !/^percurso-[a-f0-9-]{36}$/.test(p.id) ||
      Object.keys(p).some(
        (k) =>
          ![
            "tipo",
            "versao",
            "id",
            "nome",
            "objetivo",
            "linguagem",
            "etapas",
            "revisaoOnline",
          ].includes(k),
      )
    )
      throw Error(
        "Arquivo de trilha inválido: envie somente o planejamento, sem conteúdo de aulas.",
      );
    const v = validar(
      p,
      (p.etapas ?? []).map((e) => e.aulaId),
    );
    const etapas = p.etapas.map((e, i) => {
      if (
        Object.keys(e).some(
          (k) => !["aulaId", "numero", "titulo", "grupo"].includes(k),
        ) ||
        e.numero !== Number(e.aulaId.slice(5)) ||
        typeof e.titulo !== "string" ||
        !e.titulo.trim() ||
        e.titulo.length > 200
      )
        throw Error(
          "Os metadados de cada aula devem conter somente id, número, título e grupo.",
        );
      return { ...v.etapas[i], numero: e.numero, titulo: e.titulo.trim() };
    });
    if (
      p.revisaoOnline !== undefined &&
      !/^[a-f0-9]{64}$/.test(p.revisaoOnline)
    )
      throw Error("Revisão de trilha inválida.");
    return {
      tipo: "trilha-hub",
      versao: 1,
      id: p.id,
      nome: v.nome,
      objetivo: v.objetivo,
      linguagem: v.linguagem,
      etapas,
      ...(p.revisaoOnline ? { revisaoOnline: p.revisaoOnline } : {}),
    };
  }
  function recebidos(aulas, planos = []) {
    const grupos = new Map();
    for (const plano of planos) {
      let p;
      try {
        p = validarManifesto(plano);
      } catch {
        continue;
      }
      grupos.set(p.id, {
        ...p,
        aulas: p.etapas.map((e, ordem) => {
          const a = aulas.find((a) => a.id === e.aulaId);
          return {
            ...(a ?? { id: e.aulaId, numero: e.numero, titulo: e.titulo }),
            disponivel: !!a,
            grupoPercurso: e.grupo,
            ordemPercurso: ordem,
          };
        }),
      });
    }
    const oficiais = new Set(grupos.keys());
    for (const a of ordenar(aulas))
      for (const p of Array.isArray(a.percursos) ? a.percursos : []) {
        if (
          !p ||
          oficiais.has(p.id) ||
          typeof p.id !== "string" ||
          !/^percurso-[a-f0-9-]{36}$/.test(p.id) ||
          typeof p.nome !== "string" ||
          p.nome.length > 120 ||
          !objetivos.includes(p.objetivo) ||
          p.linguagem !== "javascript" ||
          typeof p.grupo !== "string" ||
          p.grupo.length > 120 ||
          !Number.isInteger(p.ordem) ||
          p.ordem < 0 ||
          p.ordem > 99
        )
          continue;
        if (!grupos.has(p.id))
          grupos.set(p.id, {
            id: p.id,
            nome: p.nome,
            objetivo: p.objetivo,
            linguagem: p.linguagem,
            aulas: [],
          });
        grupos
          .get(p.id)
          .aulas.push({ ...a, grupoPercurso: p.grupo, ordemPercurso: p.ordem });
      }
    return [...grupos.values()].map((p) => ({
      ...p,
      aulas: p.aulas.sort(
        (a, b) => a.ordemPercurso - b.ordemPercurso || a.numero - b.numero,
      ),
    }));
  }
  function sugerir(aulas, escolha = {}, planos = []) {
    const percursos = recebidos(aulas, planos),
      alinhado = percursos.find(
        (p) =>
          p.objetivo === escolha?.trilha && p.linguagem === escolha?.linguagem,
      );
    const temAtividadeFora =
      alinhado &&
      aulas.some(
        (a) =>
          !a.progresso?.completa &&
          (a.estudo?.iniciada || a.progresso?.concluidos > 0) &&
          !alinhado.aulas.some((b) => b.id === a.id),
      );
    const ativo =
      percursos.find((p) => p.id === escolha?.percursoId) ||
      (!temAtividadeFora ? alinhado : null) ||
      null;
    const lista = ativo ? ativo.aulas : ordenar(aulas),
      pendentes = lista.filter(
        (a) => a.disponivel !== false && !a.progresso?.completa,
      ),
      iniciadas = pendentes.filter(
        (a) => a.estudo?.iniciada || a.progresso?.concluidos > 0,
      );
    const recente = [...iniciadas].sort(
      (a, b) =>
        (Date.parse(b.estudo?.atualizadaEm) || 0) -
        (Date.parse(a.estudo?.atualizadaEm) || 0),
    )[0];
    const principal =
      recente ||
      pendentes[0] ||
      lista.find((a) => a.disponivel === false) ||
      lista[0] ||
      null;
    const posicao = lista.findIndex((a) => a.id === principal?.id),
      depois = pendentes.filter((a) => lista.indexOf(a) > posicao),
      antes = pendentes.filter((a) => lista.indexOf(a) < posicao);
    return {
      percursos,
      ativo,
      lista,
      principal,
      retomando: !!recente,
      concluidas: lista.filter((a) => a.progresso?.completa).length,
      iniciadas: iniciadas.length,
      naoIniciadas: pendentes.length - iniciadas.length,
      aguardando:
        lista.some((a) => a.disponivel === false) && !pendentes.length,
      bloqueadas: lista.filter((a) => a.disponivel === false),
      disponiveis: lista.filter((a) => a.disponivel !== false).length,
      finalizado: lista.length > 0 && lista.every((a) => a.progresso?.completa),
      cards: principal
        ? [
            principal,
            ...depois,
            ...lista.filter(
              (a) => a.disponivel === false && a.id !== principal.id,
            ),
            ...antes,
          ].slice(0, 3)
        : [],
    };
  }
  return {
    ordenar,
    validar,
    descrever,
    recebidos,
    sugerir,
    manifesto,
    validarManifesto,
  };
});
