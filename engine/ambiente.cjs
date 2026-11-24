"use strict";
const { fork } = require("node:child_process");
const path = require("node:path");
const { criarCliente } = require("./recursos-cliente.cjs");
const { validarAmbiente } = require("./ambiente-schema.cjs");
async function abrirAmbiente(pasta, definicao) {
  validarAmbiente(definicao);
  // SQL síncrono pode prender uma chamada nativa. Um processo permite interrompê-la
  // sem esperar que o SQLite devolva o controle ao JavaScript.
  const worker = fork(path.join(__dirname, "ambiente-processo.cjs"), [], {
    execArgv: [
      "--max-old-space-size=128",
      "--disable-warning=ExperimentalWarning",
    ],
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  let fechado = false;
  worker.once("exit", () => {
    fechado = true;
  });
  async function parar() {
    if (fechado) return;
    await new Promise((resolve) => {
      worker.once("exit", resolve);
      worker.kill();
    });
    fechado = true;
  }
  try {
    const conexao = await new Promise((resolve, reject) => {
      const prazo = setTimeout(
        () => reject(Error("O ambiente não iniciou em 6 segundos.")),
        6000,
      );
      worker.once("message", (m) => {
        clearTimeout(prazo);
        m.erro ? reject(Error(m.erro)) : resolve(m.conexao);
      });
      worker.once("error", (e) => {
        clearTimeout(prazo);
        reject(e);
      });
      worker.once("exit", () => {
        clearTimeout(prazo);
        reject(Error("O ambiente foi encerrado."));
      });
      worker.send({ pasta, definicao });
    });
    const cliente = criarCliente(conexao);
    return {
      conexao,
      get fechado() {
        return fechado;
      },
      parar,
      async operar(dado) {
        if (fechado) throw Error("Ambiente encerrado. Reabra a bancada.");
        try {
          return await cliente.operar(dado.recurso, dado.acao, dado);
        } catch (e) {
          if (e.name === "TimeoutError") {
            await parar();
            throw Error(
              "Operação interrompida por tempo limite. Reabra o ambiente; dados em memória serão reiniciados.",
            );
          }
          throw e;
        }
      },
    };
  } catch (e) {
    await parar();
    throw e;
  }
}
module.exports = { abrirAmbiente };
