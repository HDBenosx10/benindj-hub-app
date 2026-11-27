(function (root) {
  "use strict";
  // Mede interação com a janela, não atenção cognitiva. O relógio é monotônico.
  function criar({
    agora = () => performance.now(),
    registrar,
    limiteInativo = 300000,
    limiteSalto = 30000,
  }) {
    let anterior = agora(),
      ultimaInteracao = anterior,
      contexto = null;
    let visivel = true,
      foco = true,
      manual = false;
    function motivo(t = agora()) {
      if (!contexto) return "fora-da-aula";
      if (manual) return "manual";
      if (!visivel || !foco) return "janela-inativa";
      if (t - ultimaInteracao >= limiteInativo) return "inatividade";
      return null;
    }
    function atualizar() {
      const t = agora();
      // Um intervalo sem pulsos pode ser suspensão do computador: não o credita.
      if (contexto && !manual && visivel && foco && t - anterior <= limiteSalto) {
        const fim = Math.min(t, ultimaInteracao + limiteInativo);
        const ms = Math.max(0, fim - anterior);
        if (ms) registrar({ ...contexto, milisegundos: ms });
      }
      anterior = t;
      return motivo(t);
    }
    return {
      atualizar,
      contexto(novo) {
        atualizar();
        contexto = novo;
      },
      interagir() {
        atualizar();
        ultimaInteracao = agora();
      },
      janela(estado) {
        atualizar();
        visivel = estado.visivel;
        foco = estado.foco;
      },
      pausar(valor) {
        atualizar();
        manual = valor;
        if (!valor) ultimaInteracao = agora();
      },
      limite(ms) {
        atualizar();
        limiteInativo = ms;
      },
      motivo,
    };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { criar };
  else root.HubTempoAtivo = { criar };
})(typeof globalThis !== "undefined" ? globalThis : this);
