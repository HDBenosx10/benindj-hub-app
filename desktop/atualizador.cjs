"use strict";
const crypto = require("node:crypto"),
  semver = require("semver");
function validarManifesto(raw, assinatura, publicKey, perfil, versaoAtual) {
  if (
    Buffer.byteLength(raw) > 32000 ||
    assinatura.length > 500 ||
    !crypto.verify(
      null,
      Buffer.from(raw),
      publicKey,
      Buffer.from(assinatura.trim(), "base64"),
    )
  )
    throw Error("Assinatura de atualização inválida.");
  const m = JSON.parse(raw);
  if (
    m.schema !== 1 ||
    m.perfil !== perfil ||
    m.canal !== "stable" ||
    !semver.valid(m.versao) ||
    semver.prerelease(m.versao) ||
    !Array.isArray(m.arquivos) ||
    m.arquivos.length !== 2
  )
    throw Error("Manifesto de atualização inválido.");
  const titulo = perfil === "professor" ? "Professor" : "Aluno";
  for (const tipo of ["nsis", "portable"]) {
    const a = m.arquivos.find((a) => a.tipo === tipo),
      nome = `BeninDJ-Hub-${titulo}-${m.versao}-${tipo === "nsis" ? "Instalador-" : ""}Windows-x64.exe`;
    if (
      !a ||
      a.nome !== nome ||
      !Number.isSafeInteger(a.tamanho) ||
      a.tamanho <= 0 ||
      a.tamanho > 1_000_000_000 ||
      !/^[-A-Za-z0-9+/]{86}==$/.test(a.sha512)
    )
      throw Error("Artefato de atualização inválido.");
  }
  return { manifesto: m, nova: semver.gt(m.versao, versaoAtual) };
}
function criarAtualizador({
  updater,
  perfil,
  versao,
  publicKey,
  feedProfessor,
  aoMudar = () => {},
  antesDeInstalar,
  portable = false,
  empacotado = true,
  fetchImpl = fetch,
  plataforma = process.platform,
}) {
  let estado = { fase: "ocioso", versaoAtual: versao, portable },
    ocupado = false,
    conferido = null,
    feed = null;
  const mudar = (fase, dados = {}) => {
    estado = { ...estado, fase, ...dados };
    aoMudar({ ...estado });
    return { ...estado };
  };
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.disableWebInstaller = true;
  updater.logger = null;
  updater.on("download-progress", (p) => {
    if (conferido)
      mudar("baixando", {
        progresso: Math.max(0, Math.min(100, Number(p.percent) || 0)),
      });
  });
  updater.on("error", () => {
    if (ocupado) {
      ocupado = false;
      conferido = null;
      mudar("erro", {
        mensagem: "Não foi possível concluir a atualização. Tente novamente.",
      });
    }
  });
  async function verificar() {
    if (plataforma === "darwin")
      return mudar("manual", {
        mensagem: "No macOS, baixe a nova versão pela página de releases e substitua o aplicativo em Aplicativos. Seus dados ficam preservados. A atualização automática ainda não está disponível para Mac.",
      });
    if (ocupado) return { ...estado };
    if (!empacotado)
      return mudar("desenvolvimento", {
        mensagem: "O updater funciona no aplicativo empacotado.",
      });
    ocupado = true;
    conferido = null;
    mudar("verificando", { mensagem: "Consultando versão oficial…" });
    try {
      if (perfil === "professor") {
        feed = await feedProfessor();
        if (!feed)
          return mudar("conectar", {
            mensagem:
              "Conecte o Professor ao serviço para receber atualizações privadas.",
          });
      } else
        feed = {
          url: "https://github.com/HDBenosx10/benindj-hub-app/releases/latest/download/",
          headers: {},
        };
      const obter = async (nome) => {
        const r = await fetchImpl(feed.url + nome, {
          headers: feed.headers,
          signal: AbortSignal.timeout(20000),
          redirect: perfil === "professor" ? "error" : "follow",
        });
        if (!r.ok) throw Error("Release indisponível.");
        const valor = await r.text();
        if (valor.length > 32000) throw Error("Resposta inesperada.");
        return valor;
      };
      const raw = await obter(`update-manifest-${perfil}.json`),
        sig = await obter(`update-manifest-${perfil}.sig`);
      const v = validarManifesto(raw, sig, publicKey, perfil, versao);
      if (!v.nova)
        return mudar("atualizado", {
          mensagem: "Você está na versão estável mais recente.",
        });
      if (!portable) {
        updater.setFeedURL(
          perfil === "professor"
            ? {
                provider: "generic",
                url: feed.url,
                requestHeaders: feed.headers,
              }
            : {
                provider: "github",
                owner: "HDBenosx10",
                repo: "benindj-hub-app",
              },
        );
        updater.requestHeaders = feed.headers;
        updater.disableDifferentialDownload = perfil === "professor";
        const resultado = await updater.checkForUpdates(),
          info = resultado?.updateInfo,
          a = v.manifesto.arquivos.find((a) => a.tipo === "nsis");
        if (
          info?.version !== v.manifesto.versao ||
          info.packages ||
          info.files?.length !== 1 ||
          !info.files.every(
            (f) =>
              f.url === a.nome && f.sha512 === a.sha512 && f.size === a.tamanho,
          )
        )
          throw Error("Metadados não correspondem à release assinada.");
      }
      conferido = v.manifesto;
      return mudar("disponivel", {
        novaVersao: conferido.versao,
        mensagem: portable
          ? "Nova versão disponível. Baixe e substitua a portable quando terminar."
          : "Nova versão disponível. Seu trabalho será salvo antes de instalar.",
      });
    } catch {
      return mudar("erro", {
        mensagem:
          "Não foi possível validar a release oficial. A versão atual continua disponível.",
      });
    } finally {
      ocupado = false;
    }
  }
  async function baixar() {
    if (ocupado) return { ...estado };
    if (!conferido || estado.fase !== "disponivel")
      throw Error("Verifique a versão antes de baixar.");
    if (portable)
      throw Error(
        "Use Baixar portable para escolher onde salvar o executável.",
      );
    ocupado = true;
    mudar("baixando", { progresso: 0 });
    try {
      await updater.downloadUpdate();
      return mudar("pronta", {
        progresso: 100,
        mensagem: "Atualização pronta. Salve e reinicie quando estiver pronto.",
      });
    } catch {
      conferido = null;
      return mudar("erro", {
        mensagem: "O download não pôde ser validado. Tente novamente.",
      });
    } finally {
      ocupado = false;
    }
  }
  async function instalar() {
    if (ocupado || portable || !conferido || estado.fase !== "pronta")
      throw Error("Baixe uma atualização validada antes de instalar.");
    ocupado = true;
    try {
      await antesDeInstalar();
      updater.quitAndInstall(false, true);
    } catch (e) {
      ocupado = false;
      throw Error(
        "Não foi possível salvar e iniciar a atualização. " + e.message,
      );
    }
  }
  return {
    verificar,
    baixar,
    instalar,
    estado: () => ({ ...estado }),
    portableConferida() {
      if (!portable || !conferido) throw Error("Verifique a versão primeiro.");
      const a = conferido.arquivos.find((a) => a.tipo === "portable");
      return {
        arquivo: a,
        url:
          perfil === "professor"
            ? feed.url + a.nome
            : `https://github.com/HDBenosx10/benindj-hub-app/releases/download/v${conferido.versao}/${a.nome}`,
        headers: feed.headers,
      };
    },
  };
}
module.exports = { criarAtualizador, validarManifesto };
