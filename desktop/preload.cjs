"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("laboratorioDesktop", {
  nuvem: (op, dado) => ipcRenderer.invoke("hub-acervo", op, dado),
  atualizacao: (op) => ipcRenderer.invoke("hub-updater", op),
  aoAtualizar: (callback) => {
    if (typeof callback !== "function") return;
    const ouvir = (_evento, estado) => callback(estado);
    ipcRenderer.on("hub-atualizacao", ouvir);
    return () => ipcRenderer.removeListener("hub-atualizacao", ouvir);
  },
  aoFechar: (salvar) => {
    ipcRenderer.on("salvar-antes-de-sair", async () => {
      try {
        await salvar();
        ipcRenderer.send("respostas-salvas", { ok: true });
      } catch (erro) {
        ipcRenderer.send("respostas-salvas", {
          ok: false,
          erro: String(erro.message),
        });
      }
    });
  },
  aoAbrirAulas: (callback) => {
    if (typeof callback !== "function") return;
    const ouvinte = (_evento, fontes) => callback(fontes);
    ipcRenderer.on("aulas-abertas", ouvinte);
    return () => ipcRenderer.removeListener("aulas-abertas", ouvinte);
  },
  aoAbrirAula: (callback) => {
    if (typeof callback !== "function") {
      return;
    }
    const ouvinte = (_evento, aula) => callback(aula);
    ipcRenderer.on("aula-aberta", ouvinte);
    return () => ipcRenderer.removeListener("aula-aberta", ouvinte);
  },
});
