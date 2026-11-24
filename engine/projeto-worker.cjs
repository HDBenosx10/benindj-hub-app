"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const path = require("node:path");
const { inspect } = require("node:util");

for (const metodo of ["log", "info", "warn", "error", "table"]) {
  console[metodo] = (...valores) => {
    parentPort.postMessage({
      tipo: "log",
      texto: valores
        .map((valor) =>
          typeof valor === "string"
            ? valor
            : inspect(valor, { depth: 4, colors: false }),
        )
        .join(" ")
        .slice(0, 5000),
    });
  };
}

let servidor;
async function iniciar() {
  const entrada = require(path.join(workerData.pasta, "app.cjs"));
  servidor = await entrada.criarServidor({
    caminhoBanco: workerData.banco,
    recursos: workerData.conexao
      ? require("./recursos-cliente.cjs").criarCliente(workerData.conexao)
      : undefined,
  });
  servidor.on("request", (requisicao) => {
    parentPort.postMessage({
      tipo: "requisicao",
      metodo: requisicao.method,
      caminho: new URL(requisicao.url, "http://localhost").pathname,
    });
  });
  await new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  parentPort.postMessage({
    tipo: "pronto",
    base: `http://127.0.0.1:${servidor.address().port}`,
  });
}

parentPort.on("message", async (mensagem) => {
  if (mensagem.tipo === "parar") {
    if (!servidor) {
      process.exit(0);
    }
    servidor.close(() => process.exit(0));
    servidor.closeAllConnections();
  }
  if (mensagem.tipo === "modulo") {
    try {
      if (mensagem.arquivo === null) {
        parentPort.postMessage({
          tipo: "modulo",
          id: mensagem.id,
          valor: true,
        });
        return;
      }
      const modulo = require(path.join(workerData.pasta, mensagem.arquivo));
      const valor = await modulo[mensagem.funcao](...mensagem.argumentos);
      parentPort.postMessage({ tipo: "modulo", id: mensagem.id, valor });
    } catch (erro) {
      parentPort.postMessage({
        tipo: "modulo",
        id: mensagem.id,
        erro: erro.message,
      });
    }
  }
});

iniciar().catch((erro) => {
  parentPort.postMessage({ tipo: "falha", erro: erro.stack ?? erro.message });
});
