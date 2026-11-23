"use strict";
const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads");
if (!isMainThread) {
  const { inspect } = require("node:util");
  const consoleLivre = {};
  let linhas = 0;
  for (const tipo of ["log", "info", "warn", "error", "table", "debug"]) {
    consoleLivre[tipo] = (...valores) => {
      if (linhas++ < 100) {
        parentPort.postMessage({
          linha: valores
            .map((v) =>
              typeof v === "string"
                ? v
                : inspect(v, { depth: 5, maxArrayLength: 50, colors: false }),
            )
            .join(" ")
            .slice(0, 6000),
        });
      }
    };
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  Promise.resolve()
    .then(() =>
      new AsyncFunction("console", "require", workerData.codigo)(consoleLivre, require),
    )
    .then(() => parentPort.postMessage({ fim: true }))
    .catch((erro) =>
      parentPort.postMessage({
        fim: true,
        erro: String(erro.stack ?? erro).slice(0, 5000),
      }),
    );
} else {
  exports.executar = (codigo, prazo = 5000) =>
    new Promise((resolve) => {
      const inicio = Date.now();
      const saida = [];
      let encerrou = false;
      const worker = new Worker(__filename, {
        workerData: { codigo },
        resourceLimits: { maxOldGenerationSizeMb: 96 },
      });
      function fim(erro) {
        if (encerrou) {
          return;
        }
        encerrou = true;
        clearTimeout(timer);
        worker.terminate();
        resolve({ saida, erro: erro ?? null, duracao: Date.now() - inicio });
      }
      const timer = setTimeout(
        () =>
          fim(
            "Execução interrompida após 5 segundos. Confira laços e Promises pendentes.",
          ),
        prazo,
      );
      worker.on("message", (m) => {
        if (m.linha !== undefined) {
          saida.push(m.linha);
        }
        if (m.fim) {
          fim(m.erro);
        }
      });
      worker.on("error", (e) => fim(e.message));
      worker.on("exit", () => {
        if (!encerrou) {
          fim("O programa encerrou antes de concluir.");
        }
      });
    });
}
