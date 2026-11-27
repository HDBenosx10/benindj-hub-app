(function (root) {
  "use strict";

  function criar({
    mostrar,
    ocultar,
    agendar = setTimeout,
    cancelar = clearTimeout,
  }) {
    let atual = null;
    let timer;
    const dispensadas = new Set();

    function fechar() {
      cancelar(timer);
      if (atual) {
        dispensadas.add(atual.chave);
        if (dispensadas.size > 20)
          dispensadas.delete(dispensadas.values().next().value);
      }
      ocultar();
    }

    return {
      fechar,
      exibir(aviso) {
        // Consultas periódicas não prolongam o aviso nem reabrem o que foi fechado.
        if (aviso && atual?.chave === aviso.chave) return;
        cancelar(timer);
        atual = aviso;
        if (!aviso || dispensadas.has(aviso.chave)) {
          ocultar();
          return;
        }
        mostrar(aviso);
        if (aviso.duracao) timer = agendar(fechar, aviso.duracao);
      },
    };
  }

  if (typeof module !== "undefined" && module.exports)
    module.exports = { criar };
  else root.HubNotificacoes = { criar };
})(typeof globalThis !== "undefined" ? globalThis : this);
