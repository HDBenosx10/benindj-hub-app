"use strict";
const path = require("node:path");
const fs = require("node:fs/promises");
exports.gerarEditor = async function gerarEditor(destino) {
  const raiz = path.resolve(__dirname, "..");
  const resultado = await require("esbuild").build({
    entryPoints: [path.join(raiz, "editor/editor.js")],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "HubEditor",
    target: "chrome120",
    minify: true,
    outfile: path.join(destino, "editor.js"),
    metafile: true,
    legalComments: "eof",
  });
  const pacotes = new Set();
  for (const arquivo of Object.keys(resultado.metafile.inputs)) {
    const trechos = arquivo.replaceAll("\\", "/").split("node_modules/");
    if (trechos.length < 2) continue;
    const partes = trechos.at(-1).split("/");
    pacotes.add(
      partes[0].startsWith("@") ? partes.slice(0, 2).join("/") : partes[0],
    );
  }
  let licencas = "Bibliotecas do editor do BeninDJ Hub\n\n";
  for (const pacote of [...pacotes].sort()) {
    for (const nome of ["LICENSE", "LICENSE.md", "LICENSE.txt"]) {
      try {
        licencas +=
          pacote +
          "\n" +
          (await fs.readFile(
            path.join(raiz, "node_modules", pacote, nome),
            "utf8",
          )) +
          "\n\n";
        break;
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  await fs.writeFile(path.join(destino, "LICENCAS.txt"), licencas, "utf8");
  const { regras, cores } = await import(
    require("node:url").pathToFileURL(path.join(raiz, "editor/sintaxe.js"))
  );
  const css = regras
    .map(
      (r) =>
        `.${r.class}{color:${r.color};${r.fontStyle ? "font-style:" + r.fontStyle + ";" : ""}}`,
    )
    .join("\n");
  await fs.writeFile(
    path.join(destino, "editor-tema.css"),
    `.code{background:${cores.fundo};color:${cores.texto}}\n` + css + "\n",
    "utf8",
  );
};
