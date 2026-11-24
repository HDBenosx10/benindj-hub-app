"use strict";
// O inspector roda em outro processo: pausar o aluno não congela o Hub.
const inspector = require("node:inspector");
const { inspect } = require("node:util");
const vm = require("node:vm");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
let dados;
let linhas = 0;
const enviar = (m) => process.connected && process.send(m);
for (const metodo of ["log", "info", "warn", "error", "debug", "table"]) {
  console[metodo] = (...valores) => {
    if (linhas++ < 300)
      enviar({
        tipo: "log",
        texto: valores
          .map((v) =>
            typeof v === "string"
              ? v
              : inspect(v, {
                  depth: 4,
                  maxArrayLength: 40,
                  getters: false,
                  colors: false,
                }),
          )
          .join(" ")
          .slice(0, 6000),
      });
  };
}
process.on("message", async (m) => {
  try {
    if (m.tipo === "preparar") {
      dados = m.dados;
      inspector.open(0, "127.0.0.1");
      enviar({ tipo: "inspector", url: inspector.url() });
    } else if (m.tipo === "executar") {
      process.channel?.unref();
      const recursos = dados.conexao
        ? require("./recursos-cliente.cjs").criarCliente(dados.conexao)
        : undefined;
      if (!dados.pasta) {
        const executar = new vm.Script(
          "(async function(console, require, recursos) {\ndebugger;\n" +
            dados.codigo +
            "\n})",
          { filename: dados.url },
        ).runInThisContext();
        await executar(console, require, recursos);
      } else {
        const entrada = path.join(dados.pasta, dados.arquivo);
        const modulo = new Module(entrada, module);
        modulo.filename = entrada;
        modulo.paths = Module._nodeModulePaths(dados.pasta);
        require.cache[entrada] = modulo;
        modulo._compile(
          "debugger;\n" + fs.readFileSync(entrada, "utf8"),
          entrada,
        );
        modulo.loaded = true;
        if (dados.http) {
          const servidor = await modulo.exports.criarServidor({
            caminhoBanco: dados.banco,
            recursos,
          });
          // Tempo de ensino em breakpoint não deve virar timeout da API.
          servidor.requestTimeout = 0;
          servidor.headersTimeout = 0;
          servidor.setTimeout(0);
          await new Promise((resolve, reject) => {
            servidor.once("error", reject);
            servidor.listen(0, "127.0.0.1", resolve);
          });
          enviar({
            tipo: "servidor",
            base: `http://127.0.0.1:${servidor.address().port}`,
          });
          servidor.on("request", (_req, res) =>
            res.once("finish", () => enviar({ tipo: "ocioso" })),
          );
          return;
        }
        // Promises/timers do programa continuam ativos até beforeExit.
        return;
      }
      enviar({ tipo: "fim" });
    }
  } catch (erro) {
    enviar({ tipo: "fim", erro: String(erro.stack ?? erro).slice(0, 5000) });
  }
});
// A conexão IPC mantém o processo aberto; detectamos o fim de projetos finitos.
process.once("beforeExit", () => enviar({ tipo: "fim" }));
process.on("uncaughtException", (erro) =>
  enviar({ tipo: "fim", erro: String(erro.stack ?? erro) }),
);
process.on("unhandledRejection", (erro) =>
  enviar({ tipo: "fim", erro: String(erro?.stack ?? erro) }),
);
process.once("disconnect", () => process.exit(0));
