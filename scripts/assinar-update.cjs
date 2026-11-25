"use strict";
const fs = require("node:fs/promises"),
  sync = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
async function assinar({ pasta, perfil, versao, privada }) {
  const validar = require("./release-version.cjs").validarVersao;
  versao = validar(versao);
  if (!["aluno", "professor"].includes(perfil)) throw Error("Edição inválida.");
  const titulo = perfil === "professor" ? "Professor" : "Aluno";
  const arquivos = [];
  for (const tipo of ["nsis", "portable"]) {
    const nome = `BeninDJ-Hub-${titulo}-${versao}-${tipo === "nsis" ? "Instalador-" : ""}Windows-x64.exe`;
    const arquivo = path.join(pasta, nome),
      h = crypto.createHash("sha512");
    for await (const parte of sync.createReadStream(arquivo)) h.update(parte);
    arquivos.push({
      nome,
      tipo,
      tamanho: (await fs.stat(arquivo)).size,
      sha512: h.digest("base64"),
    });
  }
  const canal = require("semver").prerelease(versao)?.[0] ?? "latest";
  const metadados = require("js-yaml").load(
    await fs.readFile(path.join(pasta, canal + ".yml"), "utf8"),
  );
  const instalador = arquivos.find((a) => a.tipo === "nsis");
  if (
    metadados.version !== versao ||
    metadados.packages ||
    metadados.files?.length !== 1 ||
    !metadados.files.every(
      (f) =>
        f.url === instalador.nome &&
        f.sha512 === instalador.sha512 &&
        f.size === instalador.tamanho,
    )
  )
    throw Error(
      "O YAML do updater não corresponde ao instalador produzido. A release foi bloqueada.",
    );
  const manifesto = JSON.stringify(
    {
      schema: 1,
      perfil,
      versao,
      canal: versao.includes("-") ? "preview" : "stable",
      arquivos,
    },
    null,
    2,
  );
  const publicKey = require("../desktop/update-key.json").publicKey;
  const assinatura = crypto.sign(null, Buffer.from(manifesto), privada);
  if (!crypto.verify(null, Buffer.from(manifesto), publicKey, assinatura))
    throw Error(
      "A chave privada da CI não corresponde à chave pública do aplicativo.",
    );
  const base = path.join(pasta, "update-manifest-" + perfil);
  await fs.writeFile(base + ".json", manifesto);
  await fs.writeFile(base + ".sig", assinatura.toString("base64"));
}
module.exports = { assinar };
if (require.main === module)
  (async () => {
    const privada = process.env.HUB_UPDATE_PRIVATE_KEY;
    if (!privada)
      throw Error(
        "Cadastre HUB_UPDATE_PRIVATE_KEY na CI antes de publicar atualizações.",
      );
    await assinar({
      pasta: path.resolve("dist"),
      perfil: process.env.HUB_PROFILE ?? "aluno",
      versao: process.env.HUB_RELEASE_VERSION,
      privada,
    });
    console.log("Manifesto de atualização assinado e conferido.");
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
