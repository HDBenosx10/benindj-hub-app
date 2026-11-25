"use strict";
function identidade(perfil) {
  if (!["aluno", "professor"].includes(perfil)) throw Error("Edição inválida.");
  return {
    appId: "br.benindj.hub." + perfil,
    nomeInterno: "benindj-hub-" + perfil,
    nome: "BeninDJ Hub " + (perfil === "professor" ? "Professor" : "Aluno"),
  };
}
module.exports = { identidade };
