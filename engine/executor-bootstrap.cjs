"use strict";
const path = require("node:path");
const contexto = require("./execucao-isolada.cjs");
process.once("message", (dados) => {
  try {
    contexto.workerData = dados;
    const arquivo = path.resolve(process.argv[2]);
    if (
      !["executar.cjs", "motor-exercicios.cjs", "projeto-worker.cjs"].some(
        (nome) => arquivo === path.join(__dirname, nome),
      )
    )
      throw Error("Executor desconhecido.");
    require(arquivo);
  } catch (erro) {
    process.send(
      { tipo: "falha", fim: true, erro: erro.stack ?? erro.message },
      () => process.exit(1),
    );
  }
});
process.once("disconnect", () => process.exit(0));
