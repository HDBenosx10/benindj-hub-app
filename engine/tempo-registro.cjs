"use strict";
const { DatabaseSync } = require("node:sqlite");

function criar(caminho) {
  const banco = new DatabaseSync(caminho);
  banco.exec(`PRAGMA busy_timeout=2000;
    CREATE TABLE IF NOT EXISTS tempo (
      id TEXT PRIMARY KEY, visao TEXT NOT NULL, aula TEXT NOT NULL,
      atividade TEXT, modo TEXT NOT NULL, dia TEXT NOT NULL, ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tempo_resumo ON tempo(visao,dia,aula,atividade);`);
  const inserir = banco.prepare(
    "INSERT OR IGNORE INTO tempo(id,visao,aula,atividade,modo,dia,ms) VALUES(?,?,?,?,?,?,?)",
  );
  function resumo(visao) {
    return banco
      .prepare(
        "SELECT aula AS aulaId, atividade AS atividadeId, modo, dia, SUM(ms) AS milisegundos FROM tempo WHERE visao=? GROUP BY aula,atividade,modo,dia ORDER BY dia DESC",
      )
      .all(visao);
  }
  return {
    resumo,
    registrar(visao, eventos, validar) {
      if (!Array.isArray(eventos) || eventos.length > 100)
        throw Error("Envie até 100 registros de estudo.");
      for (const e of eventos) {
        if (
          !/^[a-f0-9-]{36}$/.test(e.id) ||
          !/^aula-\d{2}$/.test(e.aulaId) ||
          !["leitura", "pratica"].includes(e.modo) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(e.dia) ||
          !Number.isSafeInteger(e.milisegundos) ||
          e.milisegundos < 1 ||
          e.milisegundos > 900000 ||
          !(
            e.atividadeId === null ||
            (typeof e.atividadeId === "string" && e.atividadeId.length <= 100)
          )
        )
          throw Error("Registro de estudo inválido.");
        validar(e);
      }
      banco.exec("BEGIN");
      try {
        for (const e of eventos)
          inserir.run(
            e.id,
            visao,
            e.aulaId,
            e.atividadeId,
            e.modo,
            e.dia,
            e.milisegundos,
          );
        banco.exec("COMMIT");
      } catch (e) {
        banco.exec("ROLLBACK");
        throw e;
      }
      return resumo(visao);
    },
    fechar() {
      banco.close();
    },
  };
}
module.exports = { criar };
