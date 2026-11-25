"use strict";
const crypto = require("node:crypto");
try {
  if (!process.env.HUB_UPDATE_PRIVATE_KEY) throw Error("ausente");
  const publica = crypto
    .createPublicKey(process.env.HUB_UPDATE_PRIVATE_KEY)
    .export({ type: "spki", format: "pem" });
  if (publica !== require("../desktop/update-key.json").publicKey)
    throw Error("incompatível");
  console.log("Chave de assinatura da CI conferida.");
} catch {
  console.error(
    "Cadastre HUB_UPDATE_PRIVATE_KEY nos Secrets deste repositório usando a chave original do Hub. A montagem foi interrompida antes de consumir tempo de build.",
  );
  process.exitCode = 1;
}
