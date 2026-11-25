"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const MAX_AULAS = 100;
const MAX_AULA = 4_000_000;
const MAX_PACOTE = 32_000_000;
const hash = (a) =>
  a ? createHash("sha256").update(JSON.stringify(a)).digest("hex") : null;
function montarPacote(catalogo, ids, publico) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > MAX_AULAS ||
    new Set(ids).size !== ids.length
  )
    throw Error("Selecione entre 1 e 100 aulas, sem repetições.");
  const aulas = ids
    .map((id) => {
      if (typeof id !== "string" || !catalogo.has(id))
        throw Error("Uma das aulas selecionadas não está no seu acervo.");
      return publico(catalogo.get(id));
    })
    .sort((a, b) => a.numero - b.numero);
  const pacote = { tipo: "pacote-aulas-hub", versao: 1, aulas };
  if (Buffer.byteLength(JSON.stringify(pacote), "utf8") > MAX_PACOTE)
    throw Error("O pacote ultrapassa 32 MB. Exporte menos aulas por vez.");
  return pacote;
}
function criarImportador({
  aulas,
  pasta,
  validarAula,
  antesDeAtualizar = async () => {},
  depoisDeAtualizar = async () => {},
  trilhas = new Map(),
  salvarTrilha = async () => {},
}) {
  const planos = new Map();
  let confirmando = false;
  function preparar(fontes) {
    if (!Array.isArray(fontes) || !fontes.length || fontes.length > MAX_AULAS)
      throw Error("Selecione até 100 arquivos de aula ou pacotes.");
    if (
      fontes.reduce(
        (n, f) =>
          n +
          Buffer.byteLength(
            typeof f?.conteudo === "string" ? f.conteudo : "",
            "utf8",
          ),
        0,
      ) > MAX_PACOTE
    )
      throw Error(
        "Os arquivos selecionados ultrapassam 32 MB. Divida a importação em lotes menores.",
      );
    const linhas = [];
    function linha(arquivo, a, erro) {
      const item = {
        chave: linhas.length,
        arquivo,
        situacao: "invalida",
        motivo: erro ?? "",
      };
      if (!erro)
        try {
          if (Buffer.byteLength(JSON.stringify(a), "utf8") > MAX_AULA)
            throw Error("A aula ultrapassa 4 MB.");
          if (a?.tipo === "trilha-hub") {
            a = require("./percurso.js").validarManifesto(a);
            item.tipo = "trilha";
          } else validarAula(a);
          const mapa = item.tipo === "trilha" ? trilhas : aulas;
          item.id = a.id;
          item.titulo = a.titulo ?? a.nome;
          item.aula = a;
          item.anterior = hash(mapa.get(a.id));
          item.situacao =
            item.anterior === hash(a)
              ? "igual"
              : mapa.has(a.id)
                ? "existente"
                : "nova";
          const reiniciaAmbiente =
            item.situacao === "existente" &&
            JSON.stringify(aulas.get(a.id)?.ambiente) !==
              JSON.stringify(a.ambiente);
          item.motivo = {
            nova: "Pronta para importar.",
            existente:
              "Já recebida. Marque somente se quiser atualizar o conteúdo; suas respostas e seus bancos salvos em arquivo serão mantidos.",
            igual: "Esta mesma versão já está disponível.",
          }[item.situacao];
          if (reiniciaAmbiente)
            item.motivo +=
              " A configuração dos recursos mudou: serviços serão reiniciados e dados apenas em memória poderão ser reinicializados.";
        } catch (e) {
          item.motivo = e.message;
        }
      linhas.push(item);
    }
    for (const f of fontes) {
      const nome =
        typeof f?.nome === "string" ? f.nome.slice(0, 250) : "Arquivo sem nome";
      if (f?.erro) {
        linha(nome, null, String(f.erro).slice(0, 1000));
        continue;
      }
      try {
        if (typeof f?.conteudo !== "string")
          throw Error("Não foi possível ler o arquivo.");
        const dado = JSON.parse(f.conteudo.replace(/^\uFEFF/, ""));
        if (dado?.tipo === "resposta")
          throw Error(
            "Este arquivo contém respostas. Importe respostas separadamente das aulas.",
          );
        if (dado?.tipo === "pacote-aulas-hub") {
          if (
            dado.versao !== 1 ||
            !Array.isArray(dado.aulas) ||
            !dado.aulas.length ||
            dado.aulas.length > MAX_AULAS
          )
            throw Error("Pacote de aulas vazio ou em formato desconhecido.");
          for (const a of dado.aulas) linha(nome, a);
        } else linha(nome, dado);
      } catch (e) {
        linha(nome, null, "Arquivo inválido: " + e.message);
      }
    }
    if (linhas.length > MAX_AULAS)
      throw Error(
        "O lote contém mais de 100 aulas/itens. Selecione menos arquivos ou pacotes.",
      );
    const contagem = new Map();
    for (const l of linhas)
      if (l.id) contagem.set(l.id, (contagem.get(l.id) ?? 0) + 1);
    for (const l of linhas)
      if (l.id && contagem.get(l.id) > 1) {
        l.situacao = "duplicada";
        l.motivo =
          "Este id aparece mais de uma vez no lote. Remova os arquivos duplicados e importe novamente.";
      }
    for (const [id, p] of planos)
      if (p.expira < Date.now() || planos.size >= 2) planos.delete(id);
    const planoId = randomUUID();
    planos.set(planoId, { linhas, expira: Date.now() + 600000 });
    return { planoId, linhas: linhas.map(({ aula, anterior, ...l }) => l) };
  }
  async function confirmar(planoId, chaves) {
    const plano = planos.get(planoId);
    if (!plano || plano.expira < Date.now())
      throw Error("A revisão expirou. Selecione novamente os arquivos.");
    if (
      !Array.isArray(chaves) ||
      chaves.length > MAX_AULAS ||
      chaves.some((c) => !Number.isInteger(c) || !plano.linhas[c]) ||
      new Set(chaves).size !== chaves.length
    )
      throw Error("Seleção de importação inválida.");
    const assinatura = JSON.stringify([...chaves].sort((a, b) => a - b));
    if (plano.resultado) {
      if (plano.selecao !== assinatura)
        throw Error(
          "Esta importação já foi concluída. Selecione os arquivos novamente para outra revisão.",
        );
      return plano.resultado;
    }
    if (confirmando) throw Error("Aguarde a importação em andamento.");
    if (
      chaves.some(
        (c) => !["nova", "existente"].includes(plano.linhas[c].situacao),
      )
    )
      throw Error(
        "A seleção inclui itens inválidos, duplicados ou que já estão atualizados.",
      );
    confirmando = true;
    try {
      await fs.mkdir(pasta, { recursive: true });
      const selecionadas = new Set(chaves),
        resultados = [];
      for (const l of plano.linhas) {
        const base = { arquivo: l.arquivo, id: l.id, titulo: l.titulo };
        if (!selecionadas.has(l.chave)) {
          resultados.push({
            ...base,
            situacao: ["invalida", "duplicada"].includes(l.situacao)
              ? "falha"
              : "ignorada",
            motivo: l.motivo,
          });
          continue;
        }
        if (l.tipo === "trilha") {
          try {
            if (hash(trilhas.get(l.id)) !== l.anterior)
              throw Error(
                "A trilha mudou depois da revisão. Importe novamente.",
              );
            await salvarTrilha(l.aula);
            trilhas.set(l.id, l.aula);
            resultados.push({
              ...base,
              situacao: l.anterior ? "atualizada" : "importada",
              motivo:
                "Planejamento recebido. Nenhum conteúdo de aula foi desbloqueado.",
            });
          } catch (e) {
            resultados.push({ ...base, situacao: "falha", motivo: e.message });
          }
          continue;
        }
        const destino = path.join(pasta, l.id + ".hub.json"),
          temporario = destino + "." + randomUUID() + ".tmp";
        try {
          if (hash(aulas.get(l.id)) !== l.anterior)
            throw Error(
              "A aula mudou depois desta revisão. Selecione o arquivo novamente para conferir a atualização.",
            );
          await fs.writeFile(
            temporario,
            "\uFEFF" + JSON.stringify(l.aula, null, 2),
            "utf8",
          );
          if (l.anterior) {
            const backup = path.join(pasta, ".historico", planoId);
            await fs.mkdir(backup, { recursive: true });
            await fs.writeFile(
              path.join(backup, l.id + ".hub.json"),
              "\uFEFF" + JSON.stringify(aulas.get(l.id), null, 2),
              "utf8",
            );
            await antesDeAtualizar(l.id, aulas.get(l.id), l.aula);
          }
          await fs.rename(temporario, destino);
          if (l.anterior) {
            try {
              await depoisDeAtualizar(l.id, aulas.get(l.id), l.aula);
            } catch (erro) {
              await fs.writeFile(
                temporario,
                "\uFEFF" + JSON.stringify(aulas.get(l.id), null, 2),
                "utf8",
              );
              await fs.rename(temporario, destino);
              throw erro;
            }
          }
          aulas.set(l.id, l.aula);
          resultados.push({
            ...base,
            situacao: l.anterior ? "atualizada" : "importada",
            motivo: l.anterior
              ? "Conteúdo atualizado; respostas e bancos salvos em arquivo preservados."
              : "Aula adicionada. O ambiente será preparado quando você abri-la.",
          });
        } catch (e) {
          resultados.push({ ...base, situacao: "falha", motivo: e.message });
        } finally {
          await fs.rm(temporario, { force: true }).catch(() => {});
        }
      }
      plano.resultado = {
        resultados,
        resumo: {
          importadas: resultados.filter((r) => r.situacao === "importada")
            .length,
          atualizadas: resultados.filter((r) => r.situacao === "atualizada")
            .length,
          ignoradas: resultados.filter((r) => r.situacao === "ignorada").length,
          falhas: resultados.filter((r) => r.situacao === "falha").length,
        },
      };
      plano.selecao = assinatura;
      for (const l of plano.linhas) delete l.aula;
      return plano.resultado;
    } finally {
      confirmando = false;
    }
  }
  return { preparar, confirmar };
}
module.exports = {
  montarPacote,
  criarImportador,
  MAX_AULAS,
  MAX_AULA,
  MAX_PACOTE,
};
