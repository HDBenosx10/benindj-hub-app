"use strict";
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { avaliar } = require("./motor-exercicios.cjs");
const { abrirAmbiente } = require("./ambiente.cjs");
exports.avaliarComAmbiente = async (codigo, testes, definicao) => {
  if (!definicao?.recursos?.length) return avaliar(codigo, testes);
  const resultados = [];
  for (const teste of testes) {
    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-caso-"));
    let ambiente;
    try {
      ambiente = await abrirAmbiente(pasta, definicao);
      resultados.push(
        ...(await avaliar(codigo, [teste], 5000, ambiente.conexao)),
      );
    } finally {
      await ambiente?.parar();
      if (!pasta.startsWith(path.resolve(os.tmpdir()) + path.sep))
        throw Error("Pasta de teste inesperada.");
      await fs.rm(pasta, { recursive: true, force: true });
    }
  }
  return resultados;
};
