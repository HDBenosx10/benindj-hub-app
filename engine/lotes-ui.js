"use strict";
let modoSelecaoAulas = false;
const aulasSelecionadas = new Set();
let aulasVisiveis = [];
let filaImportacoes = Promise.resolve();

function atualizarSelecaoAulas() {
  $("exportar-lote").hidden = perfil !== "professor";
  $("selecao-aulas").hidden = !modoSelecaoAulas || perfil !== "professor";
  $("exportar-selecionadas").textContent =
    `Exportar selecionadas (${aulasSelecionadas.size})`;
  $("exportar-selecionadas").disabled = !aulasSelecionadas.size;
}
document.getElementById("exportar-lote").onclick = () => {
  modoSelecaoAulas = !modoSelecaoAulas;
  if (!modoSelecaoAulas) aulasSelecionadas.clear();
  renderizarBiblioteca();
};
document.getElementById("marcar-visiveis").onclick = () => {
  aulasVisiveis.forEach((id) => aulasSelecionadas.add(id));
  renderizarBiblioteca();
};
document.getElementById("limpar-selecao").onclick = () => {
  aulasSelecionadas.clear();
  renderizarBiblioteca();
};
document.getElementById("exportar-selecionadas").onclick = async () => {
  const b = $("exportar-selecionadas");
  b.disabled = true;
  try {
    const ids = [...aulasSelecionadas];
    const blob = await api("/api/aulas/exportar", { ids }, true);
    baixar(blob, `BeninDJ-Hub-${ids.length}-aulas.aulas-hub`);
    aviso("Pacote gerado apenas com as aulas selecionadas, sem gabaritos.");
  } catch (erro) {
    aviso(erro.message, true);
  } finally {
    atualizarSelecaoAulas();
  }
};

function importarFontesEmLote(fontes) {
  const trabalho = filaImportacoes.then(() => revisarImportacao(fontes));
  filaImportacoes = trabalho.catch((erro) => aviso(erro.message, true));
  return trabalho;
}
async function revisarImportacao(fontes) {
  if (perfil !== "aluno")
    throw Error(
      "Importe aulas na edição Aluno. O acervo do professor é editado no estúdio.",
    );
  if (aula) await salvar();
  const plano = await api("/api/aulas/preparar-importacao", { fontes });
  const dialogo = $("importacao-lote");
  const lista = $("itens-importacao");
  lista.replaceChildren();
  $("resumo-importacao").textContent =
    "Confira o lote. Aulas novas estão marcadas; atualizações precisam ser escolhidas. Respostas e bancos salvos em arquivo são mantidos. Se os critérios mudarem, será necessário verificar novamente.";
  const escolhas = new Map();
  const nomes = {
    nova: "Nova",
    existente: "Atualização disponível",
    igual: "Já atualizada",
    invalida: "Inválida",
    duplicada: "Duplicada",
  };
  for (const l of plano.linhas) {
    const linha = elemento(lista, "label", undefined, "item-importacao");
    const check = elemento(linha, "input");
    check.type = "checkbox";
    check.checked = l.situacao === "nova";
    check.disabled = !["nova", "existente"].includes(l.situacao);
    escolhas.set(l.chave, check);
    const texto = elemento(linha, "span");
    elemento(
      texto,
      "strong",
      `${l.tipo==='trilha'?'Trilha — ':l.id ? l.id + " — " : ""}${l.titulo ?? l.arquivo}`,
    );
    elemento(texto, "small", `${nomes[l.situacao]} · ${l.arquivo}`);
    elemento(texto, "p", l.motivo);
  }
  const confirmar = $("confirmar-importacao"),
    fechar = $("fechar-importacao");
  let executando = false,
    terminou = false;
  function atualizar() {
    const n = [...escolhas.values()].filter((c) => c.checked).length;
    confirmar.textContent = `Importar selecionadas (${n})`;
    confirmar.disabled = !n;
  }
  lista.onchange = atualizar;
  atualizar();
  confirmar.hidden = false;
  fechar.textContent = "Cancelar";
  await new Promise((resolve) => {
    dialogo.oncancel = (e) => {
      e.preventDefault();
      if (!executando) {
        dialogo.close();
        resolve();
      }
    };
    dialogo.onclose = resolve;
    fechar.onclick = () => {
      if (!executando) {
        dialogo.close();
        resolve();
      }
    };
    confirmar.onclick = async () => {
      if (executando || terminou) return;
      executando = true;
      confirmar.disabled = true;
      fechar.disabled = true;
      try {
        const chaves = [...escolhas]
          .filter(([, c]) => c.checked)
          .map(([k]) => k);
        const retorno = await api("/api/aulas/confirmar-importacao", {
          planoId: plano.planoId,
          chaves,
        });
        terminou = true;
        const r = retorno.resumo;
        $("resumo-importacao").textContent =
          `${r.importadas} adicionadas · ${r.atualizadas} atualizadas · ${r.ignoradas} ignoradas · ${r.falhas} com falha.`;
        lista.replaceChildren();
        for (const item of retorno.resultados) {
          const linha = elemento(lista, "div", undefined, "item-importacao");
          elemento(
            linha,
            "strong",
            `${item.id ?? item.arquivo}: ${item.situacao}`,
          );
          elemento(linha, "p", item.motivo);
        }
        confirmar.hidden = true;
        fechar.textContent = "Concluir";
        await carregarInicio(aula?.id);
      } catch (erro) {
        aviso(erro.message, true);
        confirmar.disabled = false;
      } finally {
        executando = false;
        fechar.disabled = false;
      }
    };
    dialogo.showModal();
  });
}
