"use strict";
const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
let janela, backend, endereco, token;
const inicioProcesso = performance.now();
let fechando = false;
const pendentes = [];
const perfil =
  (require("../package.json").hubPerfil ?? process.env.HUB_PROFILE) ===
  "professor"
    ? "professor"
    : "aluno";
// Cada edição tem seu armazenamento; uma atualização não apaga respostas.
app.setName(
  perfil === "professor" ? "BeninDJ Hub Professor" : "BeninDJ Hub Aluno",
);
app.setPath(
  "userData",
  process.env.HUB_TEST_DATA ?? path.join(app.getPath("appData"), app.getName()),
);
const somenteUma = app.requestSingleInstanceLock();
if (!somenteUma) {
  app.quit();
}
function receberArquivos(args) {
  for (const arquivo of args) {
    if (/\.(?:aula-hub|aula-acai)$/i.test(arquivo)) {
      pendentes.push(path.resolve(arquivo));
    }
  }
  entregarArquivos();
}
async function entregarArquivos() {
  if (!janela || janela.webContents.isLoading()) {
    return;
  }
  while (pendentes.length) {
    const arquivo = pendentes.shift();
    try {
      const stat = await fs.stat(arquivo);
      if (stat.size > 4000000) {
        throw Error("Aula maior que 4 MB.");
      }
      const conteudo = JSON.parse(
        (await fs.readFile(arquivo, "utf8")).replace(/^\uFEFF/, ""),
      );
      janela.webContents.send("aula-aberta", conteudo);
    } catch (e) {
      dialog.showErrorBox("Não foi possível abrir a aula", e.message);
    }
  }
}
app.on("second-instance", (_e, args) => {
  if (janela) {
    if (janela.isMinimized()) {
      janela.restore();
    }
    janela.show();
    janela.focus();
  }
  receberArquivos(args);
});
app.on("open-file", (e, arquivo) => {
  e.preventDefault();
  receberArquivos([arquivo]);
});
async function encerrarBackend() {
  if (!backend) {
    return;
  }
  const processo = backend;
  backend = null;
  const fim =
    processo.exitCode === null
      ? new Promise((resolve) => processo.once("exit", resolve))
      : Promise.resolve();
  try {
    if (endereco && token) {
      await fetch(endereco + "/api/encerrar", {
        method: "POST",
        headers: { "X-Lab-Token": token, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(2500),
      });
    }
  } catch {}
  let prazo;
  await Promise.race([
    fim,
    new Promise((resolve) => {
      prazo = setTimeout(resolve, 4000);
    }),
  ]);
  clearTimeout(prazo);
  if (processo.exitCode === null) {
    processo.kill();
  }
}
async function salvarAntesDeSair() {
  if (!janela || janela.isDestroyed() || janela.webContents.isLoading()) {
    return;
  }
  await new Promise((resolve, reject) => {
    const prazo = setTimeout(() => {
      ipcMain.removeListener("respostas-salvas", receber);
      reject(
        new Error(
          "O salvamento não respondeu. Aguarde e tente fechar novamente.",
        ),
      );
    }, 4000);
    function receber(evento, resultado) {
      if (evento.sender !== janela.webContents) {
        return;
      }
      clearTimeout(prazo);
      ipcMain.removeListener("respostas-salvas", receber);
      if (resultado?.ok) {
        resolve();
      } else {
        reject(
          new Error(resultado?.erro ?? "Não foi possível salvar as respostas."),
        );
      }
    }
    ipcMain.on("respostas-salvas", receber);
    janela.webContents.send("salvar-antes-de-sair");
  });
}
async function iniciar() {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..", ".build", "payload");
  const origem = path.join(base, "backend");
  const config = JSON.parse(
    (await fs.readFile(path.join(origem, "config.json"), "utf8")).replace(
      /^\uFEFF/,
      "",
    ),
  );
  const dados = app.getPath("userData");
  if (!process.env.HUB_TEST_DATA)
    await require("./migrate-profile.cjs").migrarPerfil(
      app.getPath("appData"),
      perfil,
      dados,
    );
  await fs.mkdir(path.join(dados, "aulas"), { recursive: true });
  await fs.copyFile(
    path.join(origem, "config.json"),
    path.join(dados, "config.json"),
  );
  for (const nome of await fs.readdir(path.join(origem, "aulas"))) {
    try {
      await fs.copyFile(
        path.join(origem, "aulas", nome),
        path.join(dados, "aulas", nome),
        require("node:fs").constants.COPYFILE_EXCL,
      );
    } catch (e) {
      if (e.code !== "EEXIST") {
        throw e;
      }
    }
  }
  if (config.perfil === "professor") {
    await fs.mkdir(path.join(dados, "conteudo"), { recursive: true });
    await fs.copyFile(
      path.join(origem, "conteudo", "aulas.json"),
      path.join(dados, "conteudo", "aulas.json"),
    );
  }
  backend = spawn(
    path.join(base, "runtime", "node.exe"),
    [path.join(origem, "servidor.cjs")],
    {
      windowsHide: true,
      env: {
        ...process.env,
        LAB_NAO_ABRIR: "1",
        LAB_PORT: "0",
        LAB_DATA_DIR: dados,
        LAB_RUNTIME_DIR: path.join(base, "runtime"),
        LAB_ELECTRON: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let erros = "";
  backend.stderr.on("data", (b) => {
    erros = (erros + b).slice(-6000);
  });
  endereco = await new Promise((resolve, reject) => {
    const prazo = setTimeout(
      () => reject(Error("O motor não iniciou. " + erros)),
      15000,
    );
    let texto = "";
    backend.stdout.on("data", (b) => {
      texto += b;
      for (const linha of texto.split(/\r?\n/)) {
        try {
          const dado = JSON.parse(linha);
          if (/^http:\/\/127\.0\.0\.1:\d+$/.test(dado.endereco)) {
            clearTimeout(prazo);
            resolve(dado.endereco);
          }
        } catch {}
      }
    });
    backend.once("error", (e) => {
      clearTimeout(prazo);
      reject(e);
    });
    backend.once("exit", () => {
      clearTimeout(prazo);
      reject(Error("O motor encerrou antes de abrir. " + erros));
    });
  });
  const html = await (await fetch(endereco)).text();
  token = html.match(/name="lab-token" content="([a-f0-9]+)"/)[1];
  janela = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 920,
    minHeight: 650,
    show: true,
    title:
      config.perfil === "professor"
        ? "BeninDJ Hub · Professor"
        : "BeninDJ Hub · Aluno",
    backgroundColor: "#22212c",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  janela.webContents.session.setPermissionRequestHandler(
    (_wc, _permissao, callback) => callback(false),
  );
  janela.webContents.setWindowOpenHandler(({ url }) => {
    const alvo = new URL(url);
    if (
      alvo.origin === endereco &&
      alvo.searchParams.get("visao") === "aluno"
    ) {
      const previa = new BrowserWindow({
        width: 1280,
        height: 900,
        parent: janela,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      previa.webContents.on("will-navigate", (e, u) => {
        if (new URL(u).origin !== endereco) {
          e.preventDefault();
        }
      });
      previa.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      previa.loadURL(url);
    } else if (
      alvo.protocol === "https:" &&
      [
        "developer.mozilla.org",
        "nodejs.org",
        "www.sqlite.org",
        "sqlite.org",
        "developers.openai.com",
        "github.com",
        "cs50.harvard.edu",
        "fullstackopen.com",
        "www.theodinproject.com",
      ].includes(alvo.hostname)
    ) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== endereco) {
      e.preventDefault();
    }
  });
  janela.webContents.on("did-finish-load", entregarArquivos);
  janela.on("close", (evento) => {
    if (fechando) {
      return;
    }
    evento.preventDefault();
    app.quit();
  });
  janela.once("ready-to-show", () => janela.show());
  backend.once("exit", (codigo) => {
    if (process.env.HUB_QA_REPORT)
      require("node:fs").appendFileSync(
        process.env.HUB_QA_REPORT + ".log",
        JSON.stringify({
          codigo,
          erros,
          fechando,
          janelaFechada: janela?.isDestroyed(),
        }) + "\n",
      );
    if (!fechando && janela && !janela.isDestroyed()) {
      if (codigo !== 0) {
        dialog.showErrorBox(
          "Motor encerrado",
          "Seu trabalho permanece salvo. Abra o aplicativo novamente.",
        );
      }
      fechando = true;
      janela.destroy();
      app.quit();
    }
  });
  await janela.loadURL(endereco);
  receberArquivos(process.argv);
  if (process.env.HUB_QA_REPORT) {
    await fs.writeFile(
      process.env.HUB_QA_REPORT,
      JSON.stringify({
        endereco,
        dados,
        perfil: config.perfil,
        pid: process.pid,
        backendPid: backend.pid,
        prontoEmMs: Math.round(performance.now() - inicioProcesso),
      }),
    );
  }
}
app.on("before-quit", (e) => {
  if (fechando) {
    return;
  }
  e.preventDefault();
  fechando = true;
  salvarAntesDeSair()
    .then(encerrarBackend)
    .then(() => app.quit())
    .catch((erro) => {
      fechando = false;
      dialog.showErrorBox(
        "Não foi possível concluir o salvamento",
        erro.message,
      );
    });
});
app.on("window-all-closed", () => app.quit());
if (somenteUma) {
  app
    .whenReady()
    .then(iniciar)
    .catch(async (e) => {
      dialog.showErrorBox("Não foi possível abrir o BeninDJ Hub", e.message);
      await encerrarBackend();
      app.exit(1);
    });
}
