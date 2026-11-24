"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { DatabaseSync, constants: C } = require("node:sqlite");
const { validarAmbiente } = require("./ambiente-schema.cjs");

async function corpo(req) {
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > 500000) throw Error("Corpo maior que 500 KB.");
    partes.push(parte);
  }
  return partes.length
    ? JSON.parse(Buffer.concat(partes).toString("utf8"))
    : {};
}
const json = (res, status, valor) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify(valor, (_k, v) => (typeof v === "bigint" ? String(v) : v)),
  );
};
function objeto(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}
function conferirFiltro(documento, filtro) {
  if (!objeto(filtro)) throw Error("O filtro deve ser um objeto JSON.");
  return Object.entries(filtro).every(([campo, valor]) => {
    if (["__proto__", "constructor", "prototype"].includes(campo))
      throw Error("Campo reservado.");
    const recebido = documento[campo];
    if (!objeto(valor) || !Object.keys(valor).some((k) => k.startsWith("$")))
      return isDeepStrictEqual(recebido, valor);
    return Object.entries(valor).every(([op, alvo]) => {
      if (op === "$gt") return recebido > alvo;
      if (op === "$gte") return recebido >= alvo;
      if (op === "$lt") return recebido < alvo;
      if (op === "$lte") return recebido <= alvo;
      if (op === "$in" && Array.isArray(alvo))
        return alvo.some((v) => isDeepStrictEqual(v, recebido));
      if (op === "$ne") return !isDeepStrictEqual(recebido, alvo);
      throw Error("Operador de filtro não suportado: " + op);
    });
  });
}
function autorizarSql(banco, recurso) {
  const ddl = new Set(
    Object.keys(C)
      .filter((k) => /^SQLITE_(CREATE|DROP|ALTER|REINDEX|ANALYZE)/.test(k))
      .map((k) => C[k]),
  );
  banco.setAuthorizer((acao, tabela, detalhe) => {
    if (
      [C.SQLITE_ATTACH, C.SQLITE_DETACH, C.SQLITE_PRAGMA].includes(acao) ||
      (acao === C.SQLITE_FUNCTION &&
        /^(load_extension|writefile|readfile)$/i.test(detalhe ?? ""))
    )
      return C.SQLITE_DENY;
    if (ddl.has(acao) && recurso.permissoes?.ddl === false)
      return C.SQLITE_DENY;
    if (
      [C.SQLITE_INSERT, C.SQLITE_UPDATE, C.SQLITE_DELETE].includes(acao) &&
      recurso.permissoes?.dml === false &&
      !(tabela === "sqlite_master" && recurso.permissoes?.ddl !== false)
    )
      return C.SQLITE_DENY;
    return C.SQLITE_OK;
  });
}
async function abrir({ pasta, definicao }) {
  const ambiente = validarAmbiente(definicao);
  await fs.mkdir(pasta, { recursive: true });
  const estados = new Map();
  const registros = [];
  const sockets = new Set();
  const timers = new Set();
  const chave = crypto.randomBytes(24).toString("hex");
  let fila = Promise.resolve();
  async function gravarDocumentos(estado) {
    if (JSON.stringify(estado.colecoes).length > 2000000)
      throw Error("Limite de 2 MB de documentos por recurso.");
    if (estado.config.modo === "arquivo") {
      const alvo = path.join(pasta, estado.config.id + ".json");
      await fs.writeFile(
        alvo + ".tmp",
        JSON.stringify(estado.colecoes),
        "utf8",
      );
      await fs.rename(alvo + ".tmp", alvo);
    }
  }
  async function prepararRecurso(recurso) {
    try {
      const estado = { config: recurso, contadores: new Map() };
      estados.set(recurso.id, estado);
      if (recurso.tipo === "sqlite") {
        const alvo = path.join(pasta, recurso.id + ".sqlite");
        const marcador = alvo + ".pronto";
        estado.banco = new DatabaseSync(
          recurso.modo === "arquivo" ? alvo : ":memory:",
          { timeout: 1000, defensive: true },
        );
        estado.banco.exec("PRAGMA max_page_count=4096");
        let preparado = false;
        if (recurso.modo === "arquivo")
          try {
            await fs.access(marcador);
            preparado = true;
          } catch {}
        if (!preparado && recurso.preparo !== "aluno") {
          autorizarSql(estado.banco, { permissoes: {} });
          try {
            estado.banco.exec(
              "BEGIN;\n" +
                (recurso.ddl ?? "") +
                "\n" +
                (recurso.seed ?? "") +
                "\nCOMMIT;",
            );
          } catch (e) {
            if (estado.banco.isTransaction) estado.banco.exec("ROLLBACK");
            throw Error(recurso.id + ": " + e.message);
          }
        }
        if (recurso.modo === "arquivo" && !preparado)
          await fs.writeFile(marcador, "1");
        autorizarSql(estado.banco, recurso);
      } else if (recurso.tipo === "documentos") {
        estado.colecoes = structuredClone(
          recurso.preparo === "aluno" ? {} : (recurso.colecoes ?? {}),
        );
        if (recurso.modo === "arquivo")
          try {
            estado.colecoes = JSON.parse(
              await fs.readFile(path.join(pasta, recurso.id + ".json"), "utf8"),
            );
          } catch (e) {
            if (e.code !== "ENOENT") throw e;
          }
        await gravarDocumentos(estado);
      }
    } catch (erro) {
      estados.get(recurso.id)?.banco?.close();
      estados.delete(recurso.id);
      throw erro;
    }
  }
  try {
    for (const recurso of ambiente.recursos) await prepararRecurso(recurso);
  } catch (erro) {
    for (const e of estados.values()) e.banco?.close();
    throw erro;
  }
  async function operar(dado) {
    if (dado.acao === "adicionar") {
      if (!ambiente.permitirCriacao)
        throw Error("A aula não permite novos recursos.");
      const nova = validarAmbiente({
        ...ambiente,
        recursos: [...ambiente.recursos, dado.definicao],
      });
      await prepararRecurso(dado.definicao);
      ambiente.recursos = nova.recursos;
      return { ok: true };
    }

    if (dado.acao === "estado")
      return {
        definicao: ambiente,
        recursos: [...estados.values()].map((e) => ({
          ...e.config,
          ...(e.banco
            ? {
                tabelas: e.banco
                  .prepare(
                    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                  )
                  .all(),
              }
            : {}),
          ...(e.colecoes
            ? {
                colecoesAtuais: Object.entries(e.colecoes).map(
                  ([nome, docs]) => ({ nome, total: docs.length }),
                ),
              }
            : {}),
        })),
        registros,
      };
    if (dado.acao === "limpar-registros") {
      registros.length = 0;
      return { ok: true };
    }
    const estado = estados.get(dado.recurso);
    if (!estado) throw Error("Recurso inexistente.");
    const r = estado.config;
    if (r.tipo === "sqlite") {
      if (
        typeof dado.sql !== "string" ||
        dado.sql.length > 50000 ||
        !["sql", "script"].includes(dado.acao)
      )
        throw Error("Informe SQL com até 50 mil caracteres.");
      if (dado.acao === "script") {
        estado.banco.exec(dado.sql);
        return {
          ok: true,
          linhas: [],
          aviso: "Script executado. Use transação para agrupar alterações.",
        };
      }
      if (!Array.isArray(dado.parametros ?? []))
        throw Error("Parâmetros devem ser um array JSON.");
      const comando = estado.banco.prepare(dado.sql);
      if (comando.columns().length) {
        const linhas = [];
        for (const linha of comando.iterate(...(dado.parametros ?? []))) {
          if (linhas.length === 1000) return { linhas, truncado: true };
          linhas.push(linha);
        }
        return { linhas, truncado: false };
      }
      return { linhas: [], ...comando.run(...(dado.parametros ?? [])) };
    }
    if (r.tipo !== "documentos")
      throw Error("Use a URL HTTP para chamar a API simulada.");
    if (
      !/^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/.test(dado.colecao ?? "") ||
      ["constructor", "prototype", "__proto__"].includes(dado.colecao)
    )
      throw Error("Nome de coleção inválido.");
    const docs = Object.hasOwn(estado.colecoes, dado.colecao)
      ? estado.colecoes[dado.colecao]
      : [];
    if (dado.acao === "buscar")
      return docs
        .filter((doc) => conferirFiltro(doc, dado.filtro ?? {}))
        .slice(0, 1000);
    if (r.permissoes?.dml === false)
      throw Error("O professor deixou este recurso somente para consulta.");
    const anterior = structuredClone(estado.colecoes);
    let resultado;
    if (dado.acao === "inserir") {
      if (!objeto(dado.documento))
        throw Error("O documento deve ser um objeto JSON.");
      if (docs.length >= 10000)
        throw Error("Limite de 10 mil documentos por coleção.");
      const doc = {
        ...dado.documento,
        _id: dado.documento._id ?? crypto.randomUUID(),
      };
      if (docs.some((d) => isDeepStrictEqual(d._id, doc._id)))
        throw Error("_id já existente.");
      estado.colecoes[dado.colecao] = [...docs, doc];
      resultado = doc;
    } else if (dado.acao === "atualizar") {
      if (
        !objeto(dado.alteracoes) ||
        Object.keys(dado.alteracoes).some((k) =>
          ["_id", "__proto__", "prototype", "constructor"].includes(k),
        )
      )
        throw Error(
          "Alterações devem ser um objeto sem _id ou campos reservados.",
        );
      let total = 0;
      estado.colecoes[dado.colecao] = docs.map((doc) =>
        conferirFiltro(doc, dado.filtro ?? {})
          ? (total++, { ...doc, ...dado.alteracoes })
          : doc,
      );
      resultado = { alterados: total };
    } else if (dado.acao === "remover") {
      estado.colecoes[dado.colecao] = docs.filter(
        (doc) => !conferirFiltro(doc, dado.filtro ?? {}),
      );
      resultado = {
        removidos: docs.length - estado.colecoes[dado.colecao].length,
      };
    } else throw Error("Operação documental desconhecida.");
    try {
      await gravarDocumentos(estado);
    } catch (e) {
      estado.colecoes = anterior;
      throw e;
    }
    return resultado;
  }
  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/operar") {
        if (req.method !== "POST" || req.headers["x-hub-chave"] !== chave)
          return json(res, 403, {
            erro: "Operação reservada ao ambiente da aula.",
          });
        const dado = await corpo(req);
        const atual = fila.catch(() => {}).then(() => operar(dado));
        fila = atual;
        return json(res, 200, await atual);
      }
      const partes = url.pathname.split("/");
      const estado = estados.get(partes[2]);
      if (partes[1] !== "mock" || estado?.config.tipo !== "mock-http")
        return json(res, 404, { erro: "API simulada inexistente." });
      const caminho = "/" + partes.slice(3).join("/");
      const rota = estado.config.rotas.find(
        (r) => r.metodo === req.method && r.caminho === caminho,
      );
      const registro = {
        recurso: estado.config.id,
        metodo: req.method,
        caminho: caminho + url.search,
        inicio: Date.now(),
        status: rota?.status ?? 404,
      };
      if (registros.length === 200) registros.shift();
      registros.push(registro);
      let recebido;
      try {
        recebido = await corpo(req);
      } catch (e) {
        registro.status = 400;
        return json(res, 400, { erro: e.message });
      }
      registro.corpo =
        JSON.stringify(recebido).length > 5000
          ? { resumo: JSON.stringify(recebido).slice(0, 5000), truncado: true }
          : recebido;
      if (!rota)
        return json(res, 404, { erro: "Rota não configurada no mock." });
      const indice = estado.contadores.get(rota) ?? 0;
      estado.contadores.set(rota, indice + 1);
      const resposta = {
        ...rota,
        ...(rota.sequencia?.[Math.min(indice, rota.sequencia.length - 1)] ??
          {}),
      };
      registro.status = resposta.status ?? 200;
      if (resposta.atrasoMs)
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            timers.delete(timer);
            resolve();
          }, resposta.atrasoMs);
          timers.add(timer);
        });
      registro.duracaoMs = Date.now() - registro.inicio;
      if (res.destroyed) {
        registro.cancelada = true;
        return;
      }
      res.writeHead(registro.status, {
        "Content-Type": "application/json; charset=utf-8",
        ...(resposta.headers ?? {}),
      });
      res.end(
        [204, 304].includes(registro.status) || req.method === "HEAD"
          ? undefined
          : JSON.stringify(resposta.corpo ?? null),
      );
    } catch (e) {
      if (!res.headersSent && !res.destroyed)
        json(res, 400, { erro: e.message });
    }
  });
  servidor.maxConnections = 64;
  servidor.requestTimeout = 15000;
  servidor.headersTimeout = 5000;
  servidor.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  return {
    conexao: {
      base: "http://127.0.0.1:" + servidor.address().port,
      chave,
      recursos: ambiente.recursos.map((r) => ({ id: r.id, tipo: r.tipo })),
    },
    async parar() {
      for (const t of timers) clearTimeout(t);
      for (const s of sockets) s.destroy();
      await new Promise((r) => servidor.close(r));
      for (const e of estados.values()) e.banco?.close();
    },
  };
}
module.exports = { abrir, conferirFiltro };
