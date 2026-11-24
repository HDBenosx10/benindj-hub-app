import { StateEffect, StateField, RangeSet } from "@codemirror/state";
import { gutter, GutterMarker, Decoration, EditorView } from "@codemirror/view";

const atualizar = StateEffect.define();
class Ponto extends GutterMarker {
  toDOM() {
    const marca = document.createElement("span");
    marca.textContent = "●";
    marca.title = "Breakpoint — clique para remover";
    return marca;
  }
}
const ponto = new Ponto();
const linhaAtual = Decoration.line({ class: "cm-debug-linha" });
const campo = StateField.define({
  create: () => ({ pontos: [], linha: null }),
  update(valor, transacao) {
    let novo = valor;
    if (transacao.docChanged)
      novo = {
        pontos: [
          ...new Set(
            valor.pontos.map(
              (p) => transacao.newDoc.lineAt(transacao.changes.mapPos(p)).from,
            ),
          ),
        ],
        linha: null,
      };
    for (const efeito of transacao.effects)
      if (efeito.is(atualizar)) novo = { ...novo, ...efeito.value };
    return novo;
  },
  provide: (campo) =>
    EditorView.decorations.from(campo, (valor) =>
      valor.linha === null
        ? Decoration.none
        : Decoration.set([linhaAtual.range(valor.linha)]),
    ),
});

export function extensoesDebug(aoAlterar) {
  return [
    campo,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const antes = update.startState
        .field(campo)
        .pontos.map((p) => update.startState.doc.lineAt(p).number);
      const depois = linhasBreakpoints(update.view);
      if (JSON.stringify(antes) !== JSON.stringify(depois)) {
        const estado = update.state;
        queueMicrotask(() => {
          if (update.view.state === estado) aoAlterar(depois, true);
        });
      }
    }),
    gutter({
      class: "cm-debug-pontos",
      initialSpacer: () => ponto,
      markers: (view) =>
        RangeSet.of(
          view.state.field(campo).pontos.map((pos) => ponto.range(pos)),
        ),
      domEventHandlers: {
        mousedown(view, linha, evento) {
          if (evento.button !== 0) return false;
          const posicao = view.state.doc.lineAt(linha.from).from;
          const pontos = view.state.field(campo).pontos;
          const novo = pontos.includes(posicao)
            ? pontos.filter((p) => p !== posicao)
            : [...pontos, posicao].sort((a, b) => a - b);
          view.dispatch({ effects: atualizar.of({ pontos: novo }) });
          aoAlterar(novo.map((p) => view.state.doc.lineAt(p).number));
          return true;
        },
      },
    }),
  ];
}
export function linhasBreakpoints(view) {
  return view.state
    .field(campo)
    .pontos.map((p) => view.state.doc.lineAt(p).number);
}
export function definirDebug(view, linhas, linhaPausada) {
  const doc = view.state.doc;
  const valor = {};
  if (linhas !== undefined)
    valor.pontos = [...new Set(linhas)]
      .filter((n) => Number.isInteger(n) && n > 0 && n <= doc.lines)
      .sort((a, b) => a - b)
      .map((n) => doc.line(n).from);
  if (linhaPausada !== undefined)
    valor.linha =
      Number.isInteger(linhaPausada) &&
      linhaPausada > 0 &&
      linhaPausada <= doc.lines
        ? doc.line(linhaPausada).from
        : null;
  view.dispatch({ effects: atualizar.of(valor) });
  if (valor.linha !== undefined && valor.linha !== null)
    view.dispatch({
      effects: EditorView.scrollIntoView(valor.linha, { y: "center" }),
    });
}
