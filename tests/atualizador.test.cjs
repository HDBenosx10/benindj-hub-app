"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const crypto = require("node:crypto"),
  { EventEmitter } = require("node:events");
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const {
  criarAtualizador,
  validarManifesto,
} = require("../desktop/atualizador.cjs");
const { baixarPortable } = require("../desktop/baixar-portable.cjs");
function cenario({
  perfil = "aluno",
  portable = false,
  alterarInfo = false,
  antesDeInstalar = async () => {},
  plataforma = "win32",
} = {}) {
  const par = crypto.generateKeyPairSync("ed25519"),
    dados = Buffer.from("executável de teste");
  const arquivos = ["nsis", "portable"].map((tipo) => ({
    tipo,
    nome: `BeninDJ-Hub-${perfil === "professor" ? "Professor" : "Aluno"}-0.12.0-${tipo === "nsis" ? "Instalador-" : ""}Windows-x64.exe`,
    tamanho: dados.length,
    sha512: crypto.createHash("sha512").update(dados).digest("base64"),
  }));
  const m = { schema: 1, perfil, versao: "0.12.0", canal: "stable", arquivos },
    raw = JSON.stringify(m),
    sig = crypto
      .sign(null, Buffer.from(raw), par.privateKey)
      .toString("base64");
  const u = new EventEmitter(),
    chamadas = [];
  Object.assign(u, {
    setFeedURL: (f) => chamadas.push(["feed", f]),
    checkForUpdates: async () => ({
      updateInfo: {
        version: m.versao,
        files: [
          {
            url: arquivos[0].nome,
            size: arquivos[0].tamanho,
            sha512: alterarInfo ? "incorreto" : arquivos[0].sha512,
          },
        ],
      },
    }),
    downloadUpdate: async () => chamadas.push(["download"]),
    quitAndInstall: () => chamadas.push(["install"]),
  });
  const requests = [];
  const atualizador = criarAtualizador({
    updater: u,
    plataforma,
    perfil,
    portable,
    versao: "0.11.2",
    publicKey: par.publicKey,
    antesDeInstalar,
    feedProfessor: async () => ({
      url: "https://acervo.example/v1/updates/professor/",
      headers: { Authorization: "Bearer privado" },
    }),
    fetchImpl: async (url, op) => {
      requests.push({ url, op });
      return new Response(url.endsWith(".sig") ? sig : raw);
    },
  });
  return { atualizador, u, chamadas, requests, raw, sig, par, dados, arquivos };
}
test("Manifesto adulterado, edição incorreta e pré-release são recusados", () => {
  const c = cenario();
  assert.equal(
    validarManifesto(c.raw, c.sig, c.par.publicKey, "aluno", "0.11.2").nova,
    true,
  );
  assert.throws(() =>
    validarManifesto(c.raw + " ", c.sig, c.par.publicKey, "aluno", "0.11.2"),
  );
  assert.throws(() =>
    validarManifesto(c.raw, c.sig, c.par.publicKey, "professor", "0.11.2"),
  );
  assert.equal(
    validarManifesto(c.raw, c.sig, c.par.publicKey, "aluno", "0.13.0").nova,
    false,
  );
  const raw = c.raw.replaceAll("0.12.0", "0.12.0-beta.1"),
    sig = crypto
      .sign(null, Buffer.from(raw), c.par.privateKey)
      .toString("base64");
  assert.throws(() =>
    validarManifesto(raw, sig, c.par.publicKey, "aluno", "0.11.2"),
  );
});

test("Abertura baixa uma atualização assinada uma única vez, sem reiniciar o estudo", async () => {
  const c = cenario();
  await Promise.all([c.atualizador.iniciarAutomaticamente(), c.atualizador.iniciarAutomaticamente()]);
  assert.equal(c.atualizador.estado().fase, "pronta");
  assert.equal(c.chamadas.filter(x=>x[0]==="download").length, 1);
  assert.equal(c.chamadas.filter(x=>x[0]==="install").length, 0);
  const consultas = c.requests.length;
  assert.equal((await c.atualizador.verificar()).fase, "pronta");
  assert.equal(c.requests.length, consultas);
  await c.atualizador.instalar();
  assert.equal(c.chamadas.at(-1)[0], "install");
});

test("Consulta automática em portable não abre download ou instalação; Mac mantém atualização manual", async () => {
  for (const opcoes of [{portable:true}, {plataforma:"darwin"}]) {
    const c = cenario(opcoes);
    await c.atualizador.iniciarAutomaticamente();
    assert.ok(!c.chamadas.some(x=>["download","install"].includes(x[0])));
  }
});

test("Abertura recusa release adulterada e permite nova tentativa manual", async () => {
  const c = cenario({alterarInfo:true});
  assert.equal((await c.atualizador.iniciarAutomaticamente()).fase,"erro");
  assert.ok(!c.chamadas.some(x=>x[0]==="download"));
  assert.equal((await c.atualizador.verificar()).fase,"erro");
});

test("Professor consulta e baixa automaticamente pelo feed privado sem expor credencial", async () => {
  const c = cenario({perfil:"professor"});
  assert.equal((await c.atualizador.iniciarAutomaticamente()).fase,"pronta");
  assert.equal(c.chamadas.filter(x=>x[0]==="download").length,1);
  assert.ok(!JSON.stringify(c.atualizador.estado()).includes("privado"));
});
test("macOS informa atualização manual sem consultar ou baixar executáveis Windows", async () => {
  const c = cenario({ plataforma: "darwin" });
  assert.equal((await c.atualizador.verificar()).fase, "manual");
  assert.equal(c.requests.length, 0);
  assert.equal(c.chamadas.length, 0);
  await assert.rejects(c.atualizador.baixar());
  await assert.rejects(c.atualizador.instalar());
});
test("Só baixa após conferir manifesto e metadados; instalação salva antes de reiniciar", async () => {
  let salvo = false;
  const c = cenario({
    antesDeInstalar: async () => {
      salvo = true;
    },
  });
  await assert.rejects(c.atualizador.baixar());
  assert.equal(c.u.autoDownload, false);
  assert.equal(c.u.autoInstallOnAppQuit, false);
  assert.equal((await c.atualizador.verificar()).fase, "disponivel");
  assert.ok(!c.chamadas.some((x) => x[0] === "download"));
  assert.equal((await c.atualizador.baixar()).fase, "pronta");
  await c.atualizador.instalar();
  assert.equal(salvo, true);
  assert.equal(c.chamadas.at(-1)[0], "install");
  assert.ok(c.requests.every((r) => !r.op.headers.Authorization));
});
test("Metadados incompatíveis bloqueiam download; falha ao salvar bloqueia instalação", async () => {
  const c = cenario({ alterarInfo: true });
  assert.equal((await c.atualizador.verificar()).fase, "erro");
  await assert.rejects(c.atualizador.baixar());
  const d = cenario({
    antesDeInstalar: async () => {
      throw Error("falha no disco");
    },
  });
  await d.atualizador.verificar();
  await d.atualizador.baixar();
  await assert.rejects(d.atualizador.instalar(), /salvar/);
  assert.ok(!d.chamadas.some((x) => x[0] === "install"));
});
test("Professor usa feed autenticado sem vazar token no estado; portable só oferece arquivo validado", async () => {
  const c = cenario({ perfil: "professor", portable: true });
  await c.atualizador.verificar();
  assert.ok(
    c.requests.every(
      (r) =>
        r.url.startsWith("https://acervo.example/") &&
        r.op.headers.Authorization,
    ),
  );
  assert.ok(!JSON.stringify(c.atualizador.estado()).includes("privado"));
  assert.equal(c.atualizador.portableConferida().arquivo.tipo, "portable");
  await assert.rejects(c.atualizador.baixar());
});
test("Portable verifica hash e tamanho e descarta download corrompido", async (t) => {
  const c = cenario(),
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "hub-update-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const destino = path.join(dir, "hub.exe");
  await assert.rejects(
    baixarPortable({
      destino,
      url: "https://example/arquivo",
      arquivo: c.arquivos[1],
      fetchImpl: async () => new Response("alterado"),
    }),
  );
  assert.deepEqual(await fs.readdir(dir), []);
  await baixarPortable({
    destino,
    url: "https://example/arquivo",
    arquivo: c.arquivos[1],
    fetchImpl: async () => new Response(c.dados),
  });
  assert.deepEqual(await fs.readFile(destino), c.dados);
});

test("Executável adicional e pacote web fora do manifesto bloqueiam o updater", async () => {
  for (const pacoteWeb of [false, true]) {
    const c = cenario();
    const a = c.arquivos[0];
    c.u.checkForUpdates = async () => ({updateInfo:{version:"0.12.0",files:[{url:a.nome,sha512:a.sha512,size:a.tamanho},...(!pacoteWeb?[{url:"outro.exe",sha512:a.sha512,size:a.tamanho}]:[])],...(pacoteWeb?{packages:{x64:{path:"outro.7z"}}}:{})}});
    assert.equal((await c.atualizador.verificar()).fase, "erro");
    await assert.rejects(c.atualizador.baixar());
  }
});
