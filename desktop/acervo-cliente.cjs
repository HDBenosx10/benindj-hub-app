"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const crypto = require("node:crypto");
const semver = require("semver");
const hash = (texto) => crypto.createHash("sha256").update(texto).digest("hex");
function criarCliente({
  pasta,
  seguro,
  perfil,
  versao,
  fetchImpl = fetch,
  permitirHttp = false,
}) {
  const arquivo = path.join(pasta, "acervo-credenciais.dpapi");
  let fila = Promise.resolve();
  function origem(valor) {
    const u = new URL(valor);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      !(
        u.protocol === "https:" ||
        (permitirHttp && u.protocol === "http:" && u.hostname === "127.0.0.1")
      )
    )
      throw Error(
        "Informe o endereço HTTPS do serviço, sem caminho adicional.",
      );
    return u.origin;
  }
  async function ler() {
    try {
      return JSON.parse(
        await seguro.descriptografar(await fs.readFile(arquivo)),
      );
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw Error(
        "A credencial não pode ser aberta neste usuário do computador. Reconecte ao serviço.",
      );
    }
  }
  async function gravar(dado) {
    await fs.mkdir(pasta, { recursive: true });
    const cifrado = await seguro.criptografar(JSON.stringify(dado));
    await fs.writeFile(arquivo + ".tmp", cifrado);
    await fs.rename(arquivo + ".tmp", arquivo);
  }
  async function requisitar(
    c,
    caminho,
    dado,
    { aluno = false, texto = false } = {},
  ) {
    const raw = dado === undefined ? "" : JSON.stringify(dado),
      metodo = dado === undefined ? "GET" : "POST";
    const headers = { ...(raw ? { "Content-Type": "application/json" } : {}) };
    if (c.tipo === "professor") headers.Authorization = "Bearer " + c.token;
    if (aluno) {
      const desafio = await requisitar(
        { ...c, tipo: "anonimo" },
        "/v1/desafios",
        { dispositivoId: c.id },
      );
      const mensagem = JSON.stringify([
        "hub-proof-v1",
        c.url,
        metodo,
        caminho,
        desafio.nonce,
        hash(raw),
      ]);
      headers["X-Hub-Device"] = c.id;
      headers["X-Hub-Nonce"] = desafio.nonce;
      headers["X-Hub-Signature"] = crypto
        .sign(null, Buffer.from(mensagem), c.privada)
        .toString("base64url");
    }
    let r;
    try {
      r = await fetchImpl(c.url + caminho, {
        method: metodo,
        headers,
        ...(raw ? { body: raw } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw Error(
        "Não foi possível conectar ao acervo. Seu conteúdo local continua disponível.",
      );
    }
    const bytes = await r.text();
    if (Buffer.byteLength(bytes) > 2_000_000)
      throw Error("Resposta do acervo maior que o permitido.");
    let body;
    try {
      body = JSON.parse(bytes);
    } catch {
      if (!texto || !r.ok)
        throw Error("O serviço devolveu uma resposta inesperada.");
    }
    if (!r.ok)
      throw Object.assign(
        Error(body?.erro ?? "Não foi possível concluir a operação no acervo."),
        { status: r.status },
      );
    return texto ? bytes : body;
  }
  async function exigir() {
    const c = await ler();
    if (!c) throw Error("Conecte ao professor primeiro.");
    return c;
  }
  async function catalogo(c) {
    return requisitar(c, "/v1/aluno/catalogo", undefined, { aluno: true });
  }
  async function executarInterno(op, dado = {}) {
    if (op === "estado") {
      const c = await ler();
      return {
        conectado: !!c && !c.pendente,
        tipo: c?.tipo ?? perfil,
        url: c?.url ?? null,
      };
    }
    if (op === "desconectar") {
      await fs.rm(arquivo, { force: true });
      return { ok: true };
    }
    if (op === "conectar-professor") {
      if (perfil !== "professor")
        throw Error("Operação exclusiva do professor.");
      const c = { tipo: "professor", url: origem(dado.url), token: dado.token };
      if (typeof c.token !== "string" || c.token.length < 40)
        throw Error("Informe a credencial administrativa do serviço.");
      await requisitar(c, "/v1/professor/painel");
      await gravar(c);
      return { ok: true };
    }
    if (op === "ativar") {
      if (perfil !== "aluno") throw Error("Abra o convite na edição Aluno.");
      if (
        typeof dado.convite !== "string" ||
        !dado.convite.startsWith("hub1_") ||
        dado.convite.length > 2000
      )
        throw Error("Cole o convite completo enviado pelo professor.");
      let convite;
      try {
        convite = JSON.parse(
          Buffer.from(dado.convite.slice(5), "base64url").toString("utf8"),
        );
      } catch {
        throw Error("Convite inválido.");
      }
      if (convite.v !== 1 || typeof convite.codigo !== "string")
        throw Error("Convite em formato desconhecido.");
      const url = origem(convite.url),
        anterior = await ler();
      if (anterior && !anterior.pendente)
        throw Error(
          "Esta instalação já está conectada. Desconecte antes de usar outro convite.",
        );
      let c = anterior?.url === url ? anterior : null;
      if (!c) {
        const par = crypto.generateKeyPairSync("ed25519");
        const publica = par.publicKey.export({ format: "jwk" });
        c = {
          tipo: "aluno",
          url,
          id: hash(publica.x),
          publica,
          privada: par.privateKey.export({ format: "pem", type: "pkcs8" }),
          pendente: true,
        };
        await gravar(c);
      }
      try {
        await requisitar({ ...c, tipo: "anonimo" }, "/v1/ativar", {
          codigo: convite.codigo,
          chave: c.publica,
          nomeDispositivo: dado.nomeDispositivo ?? "Meu computador",
        });
      } catch (e) {
        try {
          await catalogo(c);
        } catch {
          throw e;
        }
      } // Recupera resposta perdida sem reutilizar o convite.
      c.pendente = false;
      await gravar(c);
      return { ok: true };
    }
    const c = await exigir();
    if (c.tipo === "aluno") {
      if (op === "catalogo") return catalogo(c);
      if (op === "sincronizar") {
        const lista = await catalogo(c),
          fontes = [],
          indisponiveis = [];
        for (const p of lista.percursos ?? []) {
          if (dado.percursoIds && !dado.percursoIds.includes(p.trilha?.id))
            continue;
          if (hash(JSON.stringify(p.trilha)) !== p.revisao)
            throw Error(
              "Planejamento recebido não corresponde à revisão publicada.",
            );
          const trilha = require("../engine/percurso.js").validarManifesto(
            p.trilha,
          );
          fontes.push({
            nome: trilha.id + ".trilha-hub",
            conteudo: JSON.stringify({ ...trilha, revisaoOnline: p.revisao }),
          });
        }
        const ids = dado.ids ?? lista.aulas.map((a) => a.id);
        if (!Array.isArray(ids) || ids.length > 100)
          throw Error("Selecione até 100 aulas.");
        for (const a of lista.aulas.filter((a) => ids.includes(a.id))) {
          if (
            !semver.valid(a.versao_minima) ||
            !semver.gte(versao, a.versao_minima)
          ) {
            indisponiveis.push({
              id: a.id,
              titulo: a.titulo,
              motivo: "Atualize o aplicativo para abrir esta aula.",
            });
            continue;
          }
          const pacote = await requisitar(
            c,
            `/v1/aluno/aulas/${a.id}?revisao=${a.revisao}`,
            undefined,
            { aluno: true },
          );
          if (
            pacote.hash !== a.revisao ||
            hash(JSON.stringify(pacote.aula)) !== a.revisao ||
            pacote.aula.id !== a.id ||
            pacote.aula.professor
          )
            throw Error(
              "O conteúdo recebido não corresponde à revisão liberada.",
            );
          fontes.push({
            nome: a.id + ".aula-hub",
            conteudo: JSON.stringify({
              ...pacote.aula,
              distribuicao: pacote.distribuicao,
            }),
          });
        }
        return { fontes, indisponiveis };
      }
      throw Error("Operação não permitida para o aluno.");
    }
    if (perfil !== "professor") throw Error("Operação exclusiva do professor.");
    const rotas = {
      painel: "/painel",
      turma: "/turmas",
      convite: "/convites",
      "publicar-trilha": "/percursos",
      "retirar-trilha": "/retirar-trilha",
      revogar: "/revogar",
      reemitir: "/reemitir",
      "retirar-aula": "/retirar-aula",
      "verificar-marca": "/verificar-marca",
    };
    if (rotas[op])
      return requisitar(
        c,
        "/v1/professor" + rotas[op],
        op === "painel" ? undefined : dado,
      );
    if (op === "publicar") {
      if (
        !Array.isArray(dado.aulas) ||
        !dado.aulas.length ||
        dado.aulas.length > 100
      )
        throw Error("Selecione de 1 a 100 aulas.");
      const publicadas = [];
      for (const original of dado.aulas) {
        const { professor, distribuicao, ...aula } = original;
        const exigeTecnica = aula.exercicios?.some((e) =>
          e.testes?.some((t) => t.tecnica !== undefined),
        );
        if (exigeTecnica) aula.schema = 4;
        publicadas.push(
          await requisitar(c, "/v1/professor/aulas", {
            aula,
            versaoMinima: exigeTecnica ? "0.15.0" : "0.14.2",
          }),
        );
      }
      await requisitar(c, "/v1/professor/liberar", {
        turmaId: dado.turmaId,
        aulas: publicadas,
      });
      return { publicadas: publicadas.length };
    }
    throw Error("Operação não reconhecida.");
  }
  return {
    executar(op, dado) {
      const atual = fila.then(() => executarInterno(op, dado));
      fila = atual.catch(() => {});
      return atual;
    },
    async feedProfessor() {
      const c = await ler();
      if (c?.tipo !== "professor" || c.pendente) return null;
      return {
        url: c.url + "/v1/updates/professor/",
        headers: { Authorization: "Bearer " + c.token },
      };
    },
  };
}
module.exports = { criarCliente };
