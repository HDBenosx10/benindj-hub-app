"use strict";
let host;
process.once("message", async (dados) => {
  try {
    host = await require("./recursos-host.cjs").abrir(dados);
    process.send({ conexao: host.conexao });
  } catch (e) {
    process.send({ erro: e.message });
    process.disconnect();
  }
});
process.once("disconnect", async () => {
  await host?.parar();
  process.exit(0);
});
