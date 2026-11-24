"use strict";
const { fork } = require("node:child_process");
const path = require("node:path");
const bootstrap = path.join(__dirname, "executor-bootstrap.cjs");
const filho = Boolean(
  process.send &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === bootstrap,
);

// Interface pequena compartilhada pelos três executores. O código de controle
// usa mensagens; a execução acontece em outro processo Node, inclusive no Windows.
class Worker {
  constructor(arquivo, opcoes = {}) {
    const processo = fork(bootstrap, [arquivo], {
      execArgv: [
        "--max-old-space-size=" +
          (opcoes.resourceLimits?.maxOldGenerationSizeMb ?? 96),
        ...(opcoes.execArgv ?? []),
      ],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    });
    let fechado = false;
    const fechamento = new Promise((resolve) =>
      processo.once("close", () => {
        fechado = true;
        resolve();
      }),
    );
    Object.defineProperty(processo, "threadId", {
      get: () => (fechado ? -1 : processo.pid),
    });
    processo.postMessage = (mensagem) => processo.send(mensagem);
    processo.terminate = async () => {
      if (!fechado) processo.kill();
      await fechamento;
    };
    processo.send(opcoes.workerData);
    return processo;
  }
}
module.exports = {
  Worker,
  isMainThread: !filho,
  parentPort: filho
    ? {
        postMessage: (mensagem) => process.send(mensagem),
        on: (evento, acao) => process.on(evento, acao),
      }
    : null,
  workerData: undefined,
};
