(function (root) {
  "use strict";
  function criar({ listar, locais, receber, aplicar, protegidas, podeAplicar, aoEstado }) {
    let pendentes = [], ocupado = false, exigeAtualizacao = false, incompativeis = [];
    function estado(extra = {}) {
      aoEstado({ pendentes: pendentes.map((p) => p.id), revisoes: pendentes.map((p) => `${p.id}:${p.revisao}`).sort(), exigeAtualizacao, incompativeis, ...extra });
    }
    async function aplicarPendentes(incluirAberta) {
      if (!podeAplicar()) return estado();
      const protegidos = new Set(protegidas());
      const lote = pendentes.filter((p) => incluirAberta || !protegidos.has(p.id));
      if (!lote.length) return estado();
      await aplicar(lote.map((p) => p.fonte), { incluirAberta });
      pendentes = pendentes.filter((p) => !lote.includes(p));
      estado({ aplicadas: lote.map((p) => p.id), revisoesAplicadas: lote.map((p) => `${p.id}:${p.revisao}`).sort() });
    }
    return {
      async verificar() {
        if (ocupado) return;
        ocupado = true;
        try {
          const catalogo = await listar();
          const biblioteca = new Map(locais().map((a) => [a.id, a]));
          const revisoes = new Map((catalogo.aulas ?? [])
            .filter((a) => biblioteca.has(a.id) && biblioteca.get(a.id).revisaoOnline !== a.revisao)
            .map((a) => [a.id, a.revisao]));
          // Retirada/revogação nunca deixa uma revisão previamente baixada na fila.
          pendentes = pendentes.filter((p) => revisoes.get(p.id) === p.revisao);
          const ids = [...revisoes.keys()].filter((id) => !pendentes.some((p) => p.id === id));
          exigeAtualizacao = false;
          incompativeis = [];
          if (ids.length) {
            const recebido = await receber(ids);
            for (const fonte of recebido.fontes ?? []) {
              const aula = JSON.parse(fonte.conteudo);
              if (!revisoes.has(aula.id) || aula.tipo === "trilha-hub" || aula.professor)
                throw Error("A revisão recebida não pertence às aulas aguardadas.");
              pendentes.push({ id: aula.id, revisao: revisoes.get(aula.id), fonte });
            }
            exigeAtualizacao = !!recebido.indisponiveis?.length;
            incompativeis = (recebido.indisponiveis ?? []).map((a) => `${a.id}:${revisoes.get(a.id)}`).sort();
          }
          await aplicarPendentes(false);
        } catch (e) {
          // Após falha de autenticação ou rede, revalidar a liberação antes de aplicar.
          pendentes = [];
          estado({ erro: e.message });
        } finally { ocupado = false; }
      },
      async aplicarAgora() {
        if (ocupado) return;
        ocupado = true;
        try {
          // Confere novamente o acesso: a turma pode ter perdido a liberação.
          const catalogo = await listar();
          pendentes = pendentes.filter((p) => catalogo.aulas?.some((a) => a.id === p.id && a.revisao === p.revisao));
          await aplicarPendentes(true);
        } catch (e) { pendentes = []; estado({ erro: e.message }); }
        finally { ocupado = false; }
      },
    };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { criar };
  else root.HubAtualizacoesAcervo = { criar };
})(typeof globalThis !== "undefined" ? globalThis : this);
