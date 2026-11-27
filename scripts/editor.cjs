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
  licencas += "\nDracula Pro (extensão VS Code 1.1.0)\n" + await fs.readFile(path.join(raiz, "editor/temas/DRACULA-LICENSE.txt"), "utf8");
  licencas += "\nFira Code\n" + await fs.readFile(path.join(raiz, "node_modules/@fontsource/fira-code/LICENSE"), "utf8");
  await fs.writeFile(path.join(destino, "LICENCAS.txt"), licencas, "utf8");
  const { cssTema, cores } = await import(
    require("node:url").pathToFileURL(path.join(raiz, "editor/sintaxe.js"))
  );
  await fs.copyFile(path.join(raiz, "node_modules/@fontsource/fira-code/files/fira-code-latin-400-normal.woff2"), path.join(destino, "fira-code.woff2"));
  await fs.copyFile(path.join(raiz, "node_modules/@fontsource/fira-code/files/fira-code-latin-600-normal.woff2"), path.join(destino, "fira-code-semibold.woff2"));
  await fs.writeFile(
    path.join(destino, "editor-tema.css"),
    `@font-face{font-family:'Fira Code';src:url('/vendor/fira-code.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}\n@font-face{font-family:'Fira Code';src:url('/vendor/fira-code-semibold.woff2') format('woff2');font-weight:600 900;font-style:normal;font-display:swap}\n.code{background:${cores.fundo};color:${cores.texto};font-family:'Fira Code',monospace;font-variant-ligatures:contextual}\n` + cssTema() + "\n",
    "utf8",
  );
};
