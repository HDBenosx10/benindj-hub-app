"use strict";

const tipos = ["sqlite", "documentos", "mock-http"];
function validarAmbiente(ambiente) {
  if (ambiente === undefined)
    return { versao: 1, permitirCriacao: false, recursos: [] };
  if (
    !ambiente ||
    ambiente.versao !== 1 ||
    !Array.isArray(ambiente.recursos) ||
    ambiente.recursos.length > 8
  ) {
    throw Error("O ambiente deve ter versão 1 e até oito recursos.");
  }
  if (Buffer.byteLength(JSON.stringify(ambiente)) > 500000)
    throw Error("Ambiente maior que 500 KB.");
  const ids = new Set();
  if (
    ambiente.permitirCriacao !== undefined &&
    typeof ambiente.permitirCriacao !== "boolean"
  )
    throw Error("Permitir criação deve ser true ou false.");
  for (const recurso of ambiente.recursos) {
    if (
      recurso?.editavel !== undefined &&
      typeof recurso.editavel !== "boolean"
    )
      throw Error("Editável deve ser true ou false.");
    if (
      recurso?.permissoes !== undefined &&
      (!recurso.permissoes ||
        typeof recurso.permissoes !== "object" ||
        Array.isArray(recurso.permissoes) ||
        ["ddl", "dml"].some(
          (k) =>
            recurso.permissoes[k] !== undefined &&
            typeof recurso.permissoes[k] !== "boolean",
        ))
    )
      throw Error("Permissões de DDL e DML devem ser true ou false.");
    if (
      !recurso ||
      !/^[a-z][a-z0-9-]{0,39}$/.test(recurso.id) ||
      ids.has(recurso.id)
    )
      throw Error("Use identificadores únicos, como banco ou pagamentos.");
    ids.add(recurso.id);
    if (!tipos.includes(recurso.tipo))
      throw Error("Recurso desconhecido: " + recurso.tipo);
    if (!["memoria", "arquivo"].includes(recurso.modo ?? "memoria"))
      throw Error("Persistência inválida.");
    if (!["automatico", "aluno"].includes(recurso.preparo ?? "automatico"))
      throw Error("Preparo inválido.");
    if (
      recurso.tipo === "sqlite" &&
      [recurso.ddl, recurso.seed].some(
        (v) => v !== undefined && typeof v !== "string",
      )
    )
      throw Error("DDL e dados iniciais devem ser textos SQL.");
    if (
      recurso.tipo === "documentos" &&
      recurso.colecoes !== undefined &&
      (!recurso.colecoes ||
        Array.isArray(recurso.colecoes) ||
        typeof recurso.colecoes !== "object" ||
        Object.values(recurso.colecoes).some((v) => !Array.isArray(v)))
    )
      throw Error("Coleções devem mapear nomes para arrays de documentos.");
    if (recurso.tipo === "mock-http") {
      if (!Array.isArray(recurso.rotas) || recurso.rotas.length > 40)
        throw Error("A API simulada precisa de uma lista com até 40 rotas.");
      for (const rota of recurso.rotas) {
        if (
          ![
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "HEAD",
            "OPTIONS",
          ].includes(rota.metodo) ||
          typeof rota.caminho !== "string" ||
          !/^\/(?!\/)[^?#]*$/.test(rota.caminho)
        )
          throw Error("Defina método e caminho local de cada rota.");
        if (
          rota.sequencia !== undefined &&
          (!Array.isArray(rota.sequencia) ||
            !rota.sequencia.length ||
            rota.sequencia.length > 20)
        )
          throw Error("Sequência de respostas inválida.");
        for (const resposta of [rota, ...(rota.sequencia ?? [])]) {
          if (
            !Number.isInteger(resposta.status ?? 200) ||
            (resposta.status ?? 200) < 200 ||
            (resposta.status ?? 200) > 599 ||
            !Number.isInteger(resposta.atrasoMs ?? 0) ||
            (resposta.atrasoMs ?? 0) < 0 ||
            (resposta.atrasoMs ?? 0) > 10000
          )
            throw Error(
              "Status deve ficar entre 200 e 599; atraso, entre 0 e 10000 ms.",
            );
          if (
            resposta.headers &&
            Object.entries(resposta.headers).some(
              ([k, v]) =>
                !/^[\w-]+$/.test(k) ||
                typeof v !== "string" ||
                /[\r\n]/.test(v) ||
                /^(location|connection|transfer-encoding|content-length)$/i.test(
                  k,
                ),
            )
          )
            throw Error("Header de mock inválido ou reservado.");
        }
      }
    }
  }
  return structuredClone(ambiente);
}
function mesclarAmbiente(base, personalizados) {
  const original = validarAmbiente(base);
  if (!personalizados) return original;
  const novo = validarAmbiente(personalizados);
  for (const recurso of original.recursos) {
    const atual = novo.recursos.find((r) => r.id === recurso.id);
    if (!atual)
      throw Error("Um recurso fornecido pela aula não pode ser removido.");
    if (!recurso.editavel && JSON.stringify(atual) !== JSON.stringify(recurso))
      throw Error("Este recurso foi fixado pelo professor: " + recurso.id);
  }
  if (
    !original.permitirCriacao &&
    novo.recursos.some((r) => !original.recursos.some((o) => o.id === r.id))
  )
    throw Error("Esta aula não permite criar recursos adicionais.");
  novo.permitirCriacao = original.permitirCriacao;
  return novo;
}
function validarMateriais(material) {
  if (material === undefined) return;
  if (!material || typeof material !== "object" || Array.isArray(material))
    throw Error("Material complementar inválido.");
  for (const campo of ["guia", "foraDoHub", "desafiosTransferencia"])
    if (
      material[campo] !== undefined &&
      (typeof material[campo] !== "string" || material[campo].length > 50000)
    )
      throw Error("Campo de material inválido: " + campo);
  if (
    material.referencias !== undefined &&
    (!Array.isArray(material.referencias) ||
      material.referencias.length > 30 ||
      material.referencias.some(
        (r) =>
          typeof r?.titulo !== "string" ||
          typeof r?.url !== "string" ||
          !/^https:\/\//.test(r.url),
      ))
  )
    throw Error("Inclua até 30 referências com título e URL HTTPS.");
}
module.exports = { validarAmbiente, mesclarAmbiente, validarMateriais };
