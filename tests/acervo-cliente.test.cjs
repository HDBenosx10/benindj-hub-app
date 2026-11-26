"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const { criarCliente } = require("../desktop/acervo-cliente.cjs");
async function contexto(
  t,
  perfil = "aluno",
  fetchImpl = async () => new Response("{}"),
) {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "hub-acervo-"));
  t.after(() => fs.rm(pasta, { recursive: true, force: true }));
  const chave = crypto.randomBytes(32);
  const seguro = {
    async criptografar(texto) {
      const iv = crypto.randomBytes(12),
        c = crypto.createCipheriv("aes-256-gcm", chave, iv);
      const bytes = Buffer.concat([c.update(texto, "utf8"), c.final()]);
      return Buffer.concat([iv, c.getAuthTag(), bytes]);
    },
    async descriptografar(bytes) {
      const c = crypto.createDecipheriv(
        "aes-256-gcm",
        chave,
        bytes.subarray(0, 12),
      );
      c.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([c.update(bytes.subarray(28)), c.final()]).toString(
        "utf8",
      );
    },
  };
  return {
    pasta,
    seguro,
    cliente: criarCliente({
      pasta,
      seguro,
      perfil,
      versao: "0.12.0",
      fetchImpl,
    }),
  };
}
const convite =
  "hub1_" +
  Buffer.from(
    JSON.stringify({
      v: 1,
      url: "https://acervo.example",
      codigo: "convite-privado",
    }),
  ).toString("base64url");
test("Ativação protege chave privada e valida provas assinadas sem expor credenciais no estado", async (t) => {
  let publica,
    ativado = false;
  const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
  const c = await contexto(t, "aluno", async (url, op) => {
    const p = new URL(url).pathname;
    if (p === "/v1/ativar") {
      publica = JSON.parse(op.body).chave;
      assert.equal(publica.d, undefined);
      ativado = true;
      return Response.json({ ok: true });
    }
    if (p === "/v1/desafios") return Response.json({ nonce: "desafio-unico" });
    assert.equal(p, "/v1/aluno/catalogo");
    assert.equal(op.headers["X-Hub-Device"], hash(publica.x));
    const mensagem = JSON.stringify([
      "hub-proof-v1",
      "https://acervo.example",
      "GET",
      p,
      "desafio-unico",
      hash(""),
    ]);
    assert.ok(
      crypto.verify(
        null,
        Buffer.from(mensagem),
        crypto.createPublicKey({ format: "jwk", key: publica }),
        Buffer.from(op.headers["X-Hub-Signature"], "base64url"),
      ),
    );
    return Response.json({ aulas: [], turma: { nome: "JS" } });
  });
  await c.cliente.executar("ativar", { convite });
  assert.equal(ativado, true);
  assert.deepEqual(await c.cliente.executar("estado"), {
    conectado: true,
    tipo: "aluno",
    url: "https://acervo.example",
  });
  await c.cliente.executar("catalogo");
  const bytes = await fs.readFile(
    path.join(c.pasta, "acervo-credenciais.dpapi"),
  );
  assert.ok(!bytes.includes(Buffer.from("PRIVATE KEY")));
  assert.ok(!bytes.includes(Buffer.from("convite-privado")));
  await assert.rejects(
    c.cliente.executar("publicar", { aulas: [] }),
    /permitida/,
  );
  await fs.writeFile(path.join(c.pasta, "respostas.json"), "meu código");
  await c.cliente.executar("desconectar");
  assert.equal(
    await fs.readFile(path.join(c.pasta, "respostas.json"), "utf8"),
    "meu código",
  );
});
test("Resposta perdida após resgate é recuperada com a mesma chave e sem reutilizar convite", async (t) => {
  let ativacoes = 0,
    consultas = 0;
  const c = await contexto(t, "aluno", async (url) => {
    if (url.endsWith("/ativar")) {
      ativacoes++;
      throw Error("resposta perdida");
    }
    if (url.endsWith("/desafios"))
      return Response.json({ nonce: "recuperacao" });
    consultas++;
    return Response.json({ aulas: [] });
  });
  await c.cliente.executar("ativar", { convite });
  assert.equal(ativacoes, 1);
  assert.equal(consultas, 1);
  assert.equal((await c.cliente.executar("estado")).conectado, true);
});
test("Aluno recusa conexão administrativa e convite HTTP; professor remove gabaritos antes de publicar", async (t) => {
  const aluno = await contexto(t);
  await assert.rejects(
    aluno.cliente.executar("conectar-professor", {
      url: "https://acervo.example",
      token: "a".repeat(50),
    }),
    /exclusiva/,
  );
  const inseguro =
    "hub1_" +
    Buffer.from(
      JSON.stringify({ v: 1, url: "http://acervo.example", codigo: "x" }),
    ).toString("base64url");
  await assert.rejects(
    aluno.cliente.executar("ativar", { convite: inseguro }),
    /HTTPS/,
  );
  const enviados = [];
  const prof = await contexto(t, "professor", async (url, op) => {
    if (op.body) enviados.push({ url, body: JSON.parse(op.body) });
    return Response.json(
      url.endsWith("/aulas") ? { id: "aula-00", revisao: "hash" } : {},
    );
  });
  await prof.cliente.executar("conectar-professor", {
    url: "https://acervo.example",
    token: "segredo-administrativo-".repeat(3),
  });
  await prof.cliente.executar("publicar", {
    turmaId: "turma",
    aulas: [
      {
        id: "aula-00",
        professor: { gabaritos: { senha: "privado" } },
        distribuicao: { anterior: true },
        titulo: "Olá",
      },
    ],
  });
  assert.deepEqual(enviados[0].body.aula, { id: "aula-00", titulo: "Olá" });
  assert.equal(enviados[0].body.versaoMinima, "0.14.2");
  assert.equal(enviados[1].body.turmaId, "turma");
  await prof.cliente.executar("publicar", {
    turmaId: "turma",
    aulas: [
      {
        id: "aula-09",
        titulo: "Revisada",
        curadoria: { qualidade: "2026.11.integral-1" },
        professor: { gabaritos: { privado: "não enviar" } },
      },
    ],
  });
  assert.equal(enviados[2].body.versaoMinima, "0.14.2");
  assert.ok(!enviados[2].body.aula.professor);
  const tecnica = {
    schema: 3,
    id: "aula-09",
    exercicios: [
      { testes: [{ tecnica: { versao: 1, funcao: "dobro", regra: "arrow" } }] },
    ],
  };
  await prof.cliente.executar("publicar", {
    turmaId: "turma",
    aulas: [tecnica],
  });
  assert.equal(enviados[4].body.versaoMinima, "0.15.0");
  assert.equal(enviados[4].body.aula.schema, 4);
  assert.equal(tecnica.schema, 3);
  assert.ok(
    !JSON.stringify(await prof.cliente.executar("estado")).includes("segredo"),
  );
});
test("Sincronização confere revisão e versão mínima; conteúdo adulterado é recusado", async (t) => {
  const aula = { id: "aula-00", titulo: "Olá" },
    revisao = crypto
      .createHash("sha256")
      .update(JSON.stringify(aula))
      .digest("hex");
  let alterar = false;
  const c = await contexto(t, "aluno", async (url) => {
    if (url.endsWith("/ativar")) return Response.json({ ok: true });
    if (url.endsWith("/desafios")) return Response.json({ nonce: "x" });
    if (url.endsWith("/catalogo"))
      return Response.json({
        aulas: [
          {
            id: aula.id,
            titulo: aula.titulo,
            revisao,
            versao_minima: "0.11.2",
          },
          { id: "aula-01", titulo: "Futuro", versao_minima: "99.0.0" },
        ],
      });
    return Response.json({
      aula: alterar ? { ...aula, titulo: "alterada" } : aula,
      hash: revisao,
      distribuicao: { assinatura: "recibo" },
    });
  });
  await c.cliente.executar("ativar", { convite });
  const r = await c.cliente.executar("sincronizar");
  assert.equal(r.fontes.length, 1);
  assert.equal(r.indisponiveis.length, 1);
  assert.equal(
    JSON.parse(r.fontes[0].conteudo).distribuicao.assinatura,
    "recibo",
  );
  alterar = true;
  await assert.rejects(c.cliente.executar("sincronizar"), /revisão/);
});
