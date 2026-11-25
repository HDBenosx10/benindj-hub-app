"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
(async () => {
  const pasta = path.resolve(process.argv[2] ?? "dist");
  const versao = require("./release-version.cjs").validarVersao(
    process.env.HUB_RELEASE_VERSION ??
      require(path.resolve("package.json")).version,
  );
  const linhas = [];
  for (const nome of (await fs.readdir(pasta))
    .filter((n) => n.endsWith(".exe") && n.includes("-" + versao + "-"))
    .sort()) {
    const conteudo = await fs.readFile(path.join(pasta, nome));
    linhas.push(
      createHash("sha256").update(conteudo).digest("hex") + "  " + nome,
    );
  }
  if (!linhas.length) {
    throw Error("Nenhum executável para conferir.");
  }
  await fs.writeFile(
    path.join(pasta, "SHA256SUMS.txt"),
    linhas.join("\n") + "\n",
    "utf8",
  );
})();
