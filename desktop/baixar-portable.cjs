"use strict";
const fs = require("node:fs/promises"),
  sync = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
async function baixarPortable({
  destino,
  url,
  headers,
  arquivo,
  fetchImpl = fetch,
  progresso = () => {},
}) {
  const temporario = destino + "." + crypto.randomUUID() + ".download";
  try {
    const r = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(600000),
      redirect: headers?.Authorization ? "error" : "follow",
    });
    if (!r.ok || !r.body) throw Error("Download indisponível.");
    const h = crypto.createHash("sha512"),
      fd = await fs.open(temporario, "wx");
    let tamanho = 0;
    try {
      for await (const parte of r.body) {
        tamanho += parte.length;
        if (tamanho > arquivo.tamanho) throw Error("Tamanho inesperado.");
        h.update(parte);
        let offset = 0;
        while (offset < parte.length) {
          const { bytesWritten } = await fd.write(
            parte,
            offset,
            parte.length - offset,
          );
          if (!bytesWritten) throw Error("Não foi possível gravar o download.");
          offset += bytesWritten;
        }
        progresso(Math.floor((tamanho / arquivo.tamanho) * 100));
      }
    } finally {
      await fd.close();
    }
    if (tamanho !== arquivo.tamanho || h.digest("base64") !== arquivo.sha512)
      throw Error("O arquivo não corresponde à assinatura da release.");
    await fs.rename(temporario, destino);
    return { ok: true, nome: path.basename(destino) };
  } finally {
    await fs.rm(temporario, { force: true });
  }
}
module.exports = { baixarPortable };
