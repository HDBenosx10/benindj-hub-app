"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { abrirAmbiente } = require("./ambiente.cjs");
const { mesclarAmbiente, validarAmbiente } = require("./ambiente-schema.cjs");
exports.criarGerenciador = function criarGerenciador(raiz) {
  const ativos = new Map();
  function pasta(chave) {
    if (!/^(professor|aluno):aula-\d{2}(-demo)?$/.test(chave))
      throw Error("Ambiente inválido.");
    return path.join(raiz, chave.replace(":", "-"));
  }
  async function configuracao(chave, aula) {
    let alteracoes;
    try {
      alteracoes = JSON.parse(
        await fs.readFile(path.join(pasta(chave), "config.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return mesclarAmbiente(aula.ambiente, alteracoes);
  }
  async function obter(chave, aula) {
    if (!aula.ambiente) return null;
    const pendente = ativos.get(chave);
    if (pendente) {
      const anterior = await pendente;
      if (!anterior.fechado) return anterior;
      if (ativos.get(chave) !== pendente) return obter(chave, aula);
      ativos.delete(chave);
    }
    const promessa = (async () =>
      abrirAmbiente(
        path.join(pasta(chave), "dados"),
        await configuracao(chave, aula),
      ))();
    ativos.set(chave, promessa);
    try {
      return await promessa;
    } catch (e) {
      if (ativos.get(chave) === promessa) ativos.delete(chave);
      throw e;
    }
  }
  async function parar(chave) {
    const anterior = ativos.get(chave);
    ativos.delete(chave);
    await (await anterior)?.parar();
  }
  async function configurar(chave, aula, definicao) {
    const nova = mesclarAmbiente(aula.ambiente, definicao);
    const anterior = await configuracao(chave, aula);
    const soAdiciona =
      anterior.recursos.every((r) =>
        nova.recursos.some(
          (n) => n.id === r.id && JSON.stringify(n) === JSON.stringify(r),
        ),
      ) && nova.recursos.length >= anterior.recursos.length;
    if (soAdiciona) {
      const ativo = await obter(chave, aula);
      for (const recurso of nova.recursos.filter(
        (r) => !anterior.recursos.some((a) => a.id === r.id),
      ))
        await ativo.operar({ acao: "adicionar", definicao: recurso });
      ativo.conexao.recursos = nova.recursos.map((r) => ({
        id: r.id,
        tipo: r.tipo,
      }));
      await fs.writeFile(
        path.join(pasta(chave), "config.json"),
        JSON.stringify(nova),
        "utf8",
      );
      return ativo;
    }

    await parar(chave);
    await fs.mkdir(pasta(chave), { recursive: true });
    await fs.writeFile(
      path.join(pasta(chave), "config.json"),
      JSON.stringify(nova, null, 2),
      "utf8",
    );
    try {
      return await obter(chave, aula);
    } catch (erro) {
      await fs.writeFile(
        path.join(pasta(chave), "config.json"),
        JSON.stringify(anterior),
        "utf8",
      );
      await obter(chave, aula);
      throw Error(
        "Configuração recusada; a anterior foi preservada. " + erro.message,
      );
    }
  }
  async function restaurar(chave, aula) {
    await parar(chave);
    const dados = path.join(pasta(chave), "dados");
    try {
      await fs.rename(dados, path.join(pasta(chave), "backup-" + Date.now()));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return obter(chave, aula);
  }
  return {
    obter,
    parar,
    configurar,
    restaurar,
    configuracao,
    async encerrar() {
      await Promise.allSettled([...ativos.keys()].map(parar));
    },
  };
};
