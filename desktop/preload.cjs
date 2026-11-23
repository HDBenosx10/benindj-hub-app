"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("laboratorioDesktop", {
  aoFechar: (salvar) => {
    ipcRenderer.on("salvar-antes-de-sair", async () => {
      try {
        await salvar();
        ipcRenderer.send("respostas-salvas", { ok: true });
      } catch (erro) {
        ipcRenderer.send("respostas-salvas", { ok: false, erro: String(erro.message) });
      }
    });
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
