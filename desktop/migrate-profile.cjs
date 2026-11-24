"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");

// Compatibilidade de dados: estes nomes antigos nunca aparecem na interface.
exports.migrarPerfil = async function migrarPerfil(appData, perfil, destino) {
  const marcador = path.join(destino, ".migracao-v06.json");
  try {
    await fs.access(marcador);
    return false;
  } catch {}
  const antigo = path.join(
    appData,
    perfil === "professor" ? "Ateliê Açaí Professor" : "Ateliê Açaí Aluno",
  );
  await fs.mkdir(destino, { recursive: true });
  const copiados = [];
  for (const nome of ["aulas", ".dados", "professor", "conteudo"]) {
    const origem = path.join(antigo, nome);
    try {
      await fs.access(origem);
      await fs.cp(origem, path.join(destino, nome), {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
      copiados.push(nome);
    } catch (erro) {
      if (erro.code !== "ENOENT") throw erro;
    }
  }
  await fs.writeFile(
    marcador,
    JSON.stringify({
      origem: antigo,
      copiados,
      concluidaEm: new Date().toISOString(),
    }),
    "utf8",
  );
  return copiados.length > 0;
};
