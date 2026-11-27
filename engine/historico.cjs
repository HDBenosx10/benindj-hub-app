"use strict";
const { randomUUID } = require("node:crypto");
function registrar(lista, dados, motivo, atividadeId = null, aprovada = false) {
  const conteudo = structuredClone(
    atividadeId
      ? { codigos: { [atividadeId]: dados.codigos[atividadeId] } }
      : { codigos: dados.codigos, arquivos: dados.arquivos },
  );
  if (Buffer.byteLength(JSON.stringify(conteudo)) > 1500000) return lista;
  const ultima = lista[0];
  if (
    ultima &&
    ultima.atividadeId === atividadeId &&
    ultima.motivo === motivo &&
    ultima.aprovada === aprovada &&
    JSON.stringify(ultima.conteudo) === JSON.stringify(conteudo)
  )
    return lista;
  const nova = {
    id: randomUUID(),
    em: new Date().toISOString(),
    motivo,
    atividadeId,
    aprovada,
    conteudo,
  };
  // Conserva a última tentativa aprovada de cada atividade, além das recentes.
  const anteriores = [nova, ...lista];
  const aprovadas = new Map();
  for (const item of anteriores)
    if (item.aprovada && !aprovadas.has(item.atividadeId))
      aprovadas.set(item.atividadeId, item.id);
  return anteriores
    .filter((item, i) => i < 12 || aprovadas.get(item.atividadeId) === item.id)
    .slice(0, 32);
}
module.exports = { registrar };
