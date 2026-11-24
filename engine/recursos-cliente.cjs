"use strict";

function criarCliente(conexao) {
  async function operar(recurso, acao, dado = {}) {
    const resposta = await fetch(conexao.base + "/operar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Chave": conexao.chave,
      },
      body: JSON.stringify({ recurso, acao, ...dado }),
      signal: AbortSignal.timeout(4500),
    });
    const retorno = await resposta.json();
    if (!resposta.ok) throw Error(retorno.erro ?? "Falha no recurso da aula.");
    return retorno;
  }
  return {
    url(id) {
      const recurso = conexao.recursos.find(
        (r) => r.id === id && r.tipo === "mock-http",
      );
      if (!recurso) throw Error("API simulada não encontrada: " + id);
      return conexao.base + "/mock/" + id;
    },
    sqlite(id) {
      return {
        caminhoArquivo: async () => (await operar(id, "arquivo-sqlite")).caminho,
        consultar: async (sql, parametros = []) =>
          (await operar(id, "sql", { sql, parametros })).linhas,
        executar: (sql, parametros = []) =>
          operar(id, "sql", { sql, parametros }),
        script: (sql) => operar(id, "script", { sql }),
      };
    },
    documentos(id) {
      return {
        buscar: (colecao, filtro = {}) =>
          operar(id, "buscar", { colecao, filtro }),
        inserir: (colecao, documento) =>
          operar(id, "inserir", { colecao, documento }),
        atualizar: (colecao, filtro, alteracoes) =>
          operar(id, "atualizar", { colecao, filtro, alteracoes }),
        remover: (colecao, filtro) =>
          operar(id, "remover", { colecao, filtro }),
      };
    },
    operar,
  };
}
module.exports = { criarCliente };
