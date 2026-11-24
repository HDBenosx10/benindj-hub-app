import { basicSetup } from "codemirror";
import { EditorState, Compartment, Transaction, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab, isolateHistory } from "@codemirror/commands";
import {
  syntaxHighlighting,
  indentUnit,
  LanguageSupport,
} from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { sql, SQLite } from "@codemirror/lang-sql";
import { cores, destaque, linguagemJavaScript } from "./sintaxe.js";
import { formatarTexto, podeFormatar } from "./formatacao.js";
export { colorirJS } from "./sintaxe.js";

const tema = EditorView.theme(
  {
    "&": { color: cores.texto, backgroundColor: cores.fundo, height: "100%" },
    ".cm-scroller": {
      fontFamily: 'Consolas, "Cascadia Code", monospace',
      fontSize: "13px",
      lineHeight: "1.85",
      overflow: "auto",
    },
    ".cm-content": { padding: "14px 0", caretColor: cores.texto },
    ".cm-line": { padding: "0 16px" },
    ".cm-gutters": {
      backgroundColor: cores.fundo,
      color: cores.comentario,
      borderRight: "1px solid #454158",
    },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: cores.selecao },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: cores.selecao },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: cores.texto },
    "&.cm-focused": { outline: "none" },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "#80ffea20",
      outline: "1px solid #80ffea66",
    },
    ".cm-panels, .cm-tooltip": {
      backgroundColor: cores.fundo,
      color: cores.texto,
      borderColor: cores.selecao,
    },
    ".cm-searchMatch": { backgroundColor: "#ffff8030" },
  },
  { dark: true },
);

export function criar(parent, opcoes = {}) {
  const permissao = new Compartment();
  let arquivo = "atividade.js",
    chave = null,
    leitura = false,
    silencioso = false;
  let api;
  const linguagem = () =>
    /\.sql$/i.test(arquivo)
      ? sql({ dialect: SQLite })
      : /\.json$/i.test(arquivo)
        ? json()
        : new LanguageSupport(linguagemJavaScript, javascript().support);
  const extensoes = () => [
    basicSetup,
    tema,
    syntaxHighlighting(destaque),
    indentUnit.of("  "),
    EditorView.cspNonce.of(opcoes.nonce ?? ""),
    EditorView.contentAttributes.of({
      "aria-label": "Código da atividade",
      spellcheck: "false",
      autocapitalize: "off",
    }),
    permissao.of([
      EditorState.readOnly.of(leitura),
      EditorView.editable.of(!leitura),
    ]),
    linguagem(),
    Prec.highest(
      keymap.of([
        {
          key: "Shift-Alt-f",
          run: () => {
            opcoes.aoFormatar?.();
            return true;
          },
        },
        {
          key: "Mod-Enter",
          run: () => {
            opcoes.aoVerificar?.();
            return true;
          },
        },
        indentWithTab,
      ]),
    ),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !silencioso) api?.oninput?.();
    }),
  ];
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: "", extensions: extensoes() }),
  });
  const notificarEstado = () =>
    opcoes.aoEstado?.({
      somenteLeitura: leitura,
      podeFormatar: podeFormatar(arquivo),
    });
  api = {
    oninput: null,
    get value() {
      return view.state.doc.toString();
    },
    set value(texto) {
      if ((texto ?? "") === view.state.doc.toString()) return;
      silencioso = true;
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: texto ?? "" },
          annotations: Transaction.addToHistory.of(false),
        });
      } finally {
        silencioso = false;
      }
    },
    get readOnly() {
      return leitura;
    },
    set readOnly(valor) {
      leitura = Boolean(valor);
      view.dispatch({
        effects: permissao.reconfigure([
          EditorState.readOnly.of(leitura),
          EditorView.editable.of(!leitura),
        ]),
      });
      notificarEstado();
    },
    abrir(contexto, nome, texto, somenteLeitura) {
      arquivo = nome;
      leitura = Boolean(somenteLeitura);
      if (chave !== contexto) {
        chave = contexto;
        view.setState(
          EditorState.create({ doc: texto ?? "", extensions: extensoes() }),
        );
      } else {
        api.value = texto;
        api.readOnly = leitura;
      }
      notificarEstado();
    },
    notificarAlteracao() {
      api.oninput?.();
    },
    focar() {
      view.focus();
    },
    atualizarEstado() {
      notificarEstado();
    },
    async formatar() {
      if (leitura)
        throw Error("Este arquivo está disponível somente para leitura.");
      const estado = view.state;
      const resultado = await formatarTexto(
        api.value,
        arquivo,
        estado.selection.main.head,
      );
      if (view.state !== estado || leitura) return false;
      if (resultado.formatted !== api.value)
        view.dispatch({
          changes: {
            from: 0,
            to: estado.doc.length,
            insert: resultado.formatted,
          },
          selection: { anchor: resultado.cursorOffset },
          annotations: [
            isolateHistory.of("full"),
            Transaction.userEvent.of("input.format"),
          ],
        });
      view.focus();
      return true;
    },
  };
  notificarEstado();
  return api;
}
