"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const raiz = path.resolve(__dirname, "..");
const versaoNode = "24.13.0";
async function obterRuntime(destino) {
  const copia = process.env.HUB_RUNTIME_SOURCE;
  if (copia) {
    await fs.cp(path.resolve(copia), destino, { recursive: true });
    return;
  }
  const cache = path.join(raiz, ".cache");
  await fs.mkdir(cache, { recursive: true });
  if (process.platform === "darwin") {
    if (!["arm64", "x64"].includes(process.arch)) throw Error("Arquitetura macOS não suportada.");
    const nome = `node-v${versaoNode}-darwin-${process.arch}`;
    const arquivo = path.join(cache, nome + ".tar.gz");
    const extraido = path.join(cache, nome);
    try {
      await fs.access(path.join(extraido, "bin", "node"));
    } catch {
      const url = `https://nodejs.org/dist/v${versaoNode}/`;
      const [resposta, somas] = await Promise.all([fetch(url + nome + ".tar.gz"), fetch(url + "SHASUMS256.txt")]);
      if (!resposta.ok || !somas.ok) throw Error("Falha ao obter o runtime oficial do Mac.");
      const bytes = Buffer.from(await resposta.arrayBuffer());
      const esperado = (await somas.text()).split(/\r?\n/).find(l => l.trim().endsWith("  " + nome + ".tar.gz"))?.split(/\s+/)[0];
      const hash = require("node:crypto").createHash("sha256").update(bytes).digest("hex");
      if (hash !== esperado) throw Error("Hash do runtime macOS inválido.");
      await fs.writeFile(arquivo, bytes);
      await require("node:util").promisify(require("node:child_process").execFile)("tar", ["-xzf", arquivo, "-C", cache]);
    }
    await fs.mkdir(destino, { recursive: true });
    await fs.copyFile(path.join(extraido, "bin", "node"), path.join(destino, "node"));
    await fs.chmod(path.join(destino, "node"), 0o755);
    await fs.copyFile(path.join(extraido, "LICENSE"), path.join(destino, "LICENSE-Node.txt"));
    await fs.cp(path.join(extraido, "lib", "node_modules", "npm"), path.join(destino, "npm"), { recursive: true });
    return;
  }
  const arquivo = path.join(cache, `node-v${versaoNode}-win-x64.zip`);
  const extraido = path.join(cache, `node-v${versaoNode}-win-x64`);
  try {
    await fs.access(path.join(extraido, "node.exe"));
  } catch {
    const resposta = await fetch(
      `https://nodejs.org/dist/v${versaoNode}/node-v${versaoNode}-win-x64.zip`,
    );
    if (!resposta.ok) {
      throw Error("Falha ao obter o runtime oficial do Node.");
    }
    await fs.writeFile(arquivo, Buffer.from(await resposta.arrayBuffer()));
    const extrair = require("extract-zip");
    await extrair(arquivo, { dir: cache });
  }
  await fs.mkdir(destino, { recursive: true });
  await fs.copyFile(
    path.join(extraido, "node.exe"),
    path.join(destino, "node.exe"),
  );
  await fs.copyFile(
    path.join(extraido, "LICENSE"),
    path.join(destino, "LICENSE-Node.txt"),
  );
  await fs.cp(
    path.join(extraido, "node_modules", "npm"),
    path.join(destino, "npm"),
    {
      recursive: true,
    },
  );
}
exports.preparar = async (perfil = "aluno", professorRoot) => {
  const base = path.join(raiz, ".build", "payload");
  const backend = path.join(base, "backend");
  // O diretório removido é fixo e pertence exclusivamente à montagem do app.
  if (!base.startsWith(raiz + path.sep)) {
    throw Error("Diretório de montagem inválido.");
  }
  await fs.rm(base, { recursive: true, force: true });
  await fs.mkdir(backend, { recursive: true });
  await fs.cp(path.join(raiz, "engine"), backend, { recursive: true });
  if (perfil === "aluno")
    await fs.rm(path.join(backend, "curriculo.json"), { force: true });
  await require("./editor.cjs").gerarEditor(path.join(backend, "vendor"));
  await fs.mkdir(path.join(backend, "aulas"), { recursive: true });
  await fs.copyFile(
    path.join(raiz, "aulas", "aula-00.aula-hub"),
    path.join(backend, "aulas", "aula-00.hub.json"),
  );
  if (perfil === "professor") {
    const privado = path.resolve(
      professorRoot ?? path.join(raiz, "..", "benindj-hub-professor"),
    );
    await fs.cp(path.join(privado, "professor"), backend, { recursive: true });
    const aulas = [];
    for (const nome of (await fs.readdir(path.join(privado, "aulas")))
      .filter((n) => /^aula-\d{2}\.json$/.test(n))
      .sort()) {
      aulas.push(
        JSON.parse(
          (
            await fs.readFile(path.join(privado, "aulas", nome), "utf8")
          ).replace(/^\uFEFF/, ""),
        ),
      );
    }
    if (aulas.length < 45) {
      throw Error(
        "As 45 aulas iniciais precisam estar presentes no acervo privado.",
      );
    }
    await fs.mkdir(path.join(backend, "conteudo"), { recursive: true });
    await fs.writeFile(
      path.join(backend, "conteudo", "aulas.json"),
      JSON.stringify(aulas),
      "utf8",
    );
    const percursos = [];
    for (const nome of (await fs.readdir(path.join(privado, "trilhas")))
      .filter((n) => n.endsWith(".json"))
      .sort()) {
      const p = JSON.parse(
        await fs.readFile(path.join(privado, "trilhas", nome), "utf8"),
      );
      require("../engine/percurso.js").manifesto(p, aulas);
      percursos.push(p);
    }
    await fs.writeFile(
      path.join(backend, "conteudo", "percursos.json"),
      JSON.stringify(percursos),
      "utf8",
    );
  }
  await fs.writeFile(
    path.join(backend, "config.json"),
    JSON.stringify({
      perfil,
      versao: 7,
      versaoApp: process.env.HUB_RELEASE_VERSION
        ? require("./release-version.cjs").validarVersao(
            process.env.HUB_RELEASE_VERSION,
          )
        : require("../package.json").version,
      urlReleases: process.env.HUB_RELEASES_URL ?? null,
    }),
    "utf8",
  );
  await obterRuntime(path.join(base, "runtime"));
  return base;
};
