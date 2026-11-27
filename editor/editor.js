import { basicSetup } from "codemirror";
import { EditorState, Compartment, Transaction, Prec } from "@codemirror/state";
import { EditorView, keymap, ViewPlugin, Decoration } from "@codemirror/view";
import { indentWithTab, isolateHistory } from "@codemirror/commands";
import {
  syntaxHighlighting,
  indentUnit,
  LanguageSupport,
  HighlightStyle,
} from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { sql, SQLite } from "@codemirror/lang-sql";
import { cores, tokens, classeToken, linguagemJavaScript } from "./sintaxe.js";
import { formatarTexto, podeFormatar } from "./formatacao.js";
import { extensoesDebug, definirDebug, linhasBreakpoints } from "./debug.js";
export { colorirJS } from "./sintaxe.js";
export { chamadasDeTeste, argumentosChamada } from "./chamadas.js";

const tema = EditorView.theme(
  {
    "&": { color: cores.texto, backgroundColor: cores.fundo, height: "100%" },
    ".cm-scroller": {
      fontFamily: '"Fira Code", Consolas, monospace',
      fontSize: "var(--tamanho-codigo, 15px)",
      fontVariantLigatures: "var(--ligaturas-codigo, contextual)",
      fontFeatureSettings: "var(--recursos-fonte, 'calt' 1, 'liga' 1)",
      lineHeight: "1.65",
      overflow: "auto",
    },
    ".cm-content": { padding: "14px 0", caretColor: cores.texto },
    ".cm-line": { padding: "0 16px" },
    ".cm-gutters": {
      backgroundColor: cores.fundo,
      color: cores.comentario,
      borderRight: "1px solid #454158",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
      boxShadow: `inset 0 0 0 1px ${cores.selecao}`,
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: cores.texto,
    },
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
  const quebra = new Compartment();
  const documentos = new Map();
  const posicoes = new Map();
  const chavePosicao = (id) => "hub-editor-posicao:" + id;
  const guardarPosicao = () => {
    if (!chave) return;
    const posicao = {
      cursor: view.state.selection.main.head,
      scrollTop: view.scrollDOM.scrollTop,
      scrollLeft: view.scrollDOM.scrollLeft,
    };
    posicoes.set(chave, posicao);
    try {
      localStorage.setItem(chavePosicao(chave), JSON.stringify(posicao));
    } catch {}
  };
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
    extensoesDebug((linhas, automatico) =>
      opcoes.aoBreakpoints?.(linhas, automatico),
    ),
    tema,
    // Desliga as cores de fallback do basicSetup; TextMate aplica as cores finais.
    syntaxHighlighting(HighlightStyle.define([])),
    ViewPlugin.fromClass(
      class {
        constructor(v) {
          this.decorations = this.colorir(v);
        }
        update(u) {
          if (u.docChanged) this.decorations = this.colorir(u.view);
        }
        colorir(v) {
          const lang = /\.json$/i.test(arquivo)
            ? "json"
            : /\.sql$/i.test(arquivo)
              ? "sql"
              : "javascript";
          const marcas = [];
          for (const linha of tokens(v.state.doc.toString(), lang))
            for (const token of linha) {
              if (token.content.length)
                marcas.push(
                  Decoration.mark({ class: classeToken(token) }).range(
                    token.offset,
                    token.offset + token.content.length,
                  ),
                );
            }
          return Decoration.set(marcas, true);
        }
      },
      { decorations: (v) => v.decorations },
    ),
    quebra.of([]),
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
      if (update.selectionSet && !silencioso) guardarPosicao();
    }),
  ];
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: "", extensions: extensoes() }),
  });
  view.scrollDOM.addEventListener("scroll", guardarPosicao, { passive: true });
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
    get breakpoints() {
      return linhasBreakpoints(view);
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
      if (chave && chave !== contexto) {
        guardarPosicao();
        documentos.set(chave, view.state);
        if (documentos.size > 60)
          documentos.delete(documentos.keys().next().value);
      }
      arquivo = nome;
      leitura = Boolean(somenteLeitura);
      if (chave !== contexto) {
        chave = contexto;
        let estado = documentos.get(chave);
        if (!estado || estado.doc.toString() !== (texto ?? ""))
          estado = EditorState.create({
            doc: texto ?? "",
            extensions: extensoes(),
          });
        view.setState(estado);
        api.readOnly = leitura;
        let posicao = posicoes.get(chave);
        try {
          posicao ??= JSON.parse(localStorage.getItem(chavePosicao(chave)));
        } catch {}
        if (posicao) {
          const cursor = Math.max(
            0,
            Math.min(view.state.doc.length, Number(posicao.cursor) || 0),
          );
          view.dispatch({ selection: { anchor: cursor } });
          requestAnimationFrame(() => {
            if (chave !== contexto) return;
            view.scrollDOM.scrollTop = posicao.scrollTop || 0;
            view.scrollDOM.scrollLeft = posicao.scrollLeft || 0;
          });
        }
      } else {
        api.value = texto;
        api.readOnly = leitura;
      }
      notificarEstado();
    },
    notificarAlteracao() {
      api.oninput?.();
    },
    configurar({ quebrarLinhas = false } = {}) {
      view.dispatch({
        effects: quebra.reconfigure(
          quebrarLinhas ? EditorView.lineWrapping : [],
        ),
      });
      view.requestMeasure();
    },
    guardarPosicao,
    depurar(linhas, linha) {
      definirDebug(view, linhas, linha);
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
      if (resultado.formatted !== api.value) {
        // Uma substituição integral não tem correspondência segura de linhas.
        if (api.breakpoints.length) {
          definirDebug(view, [], null);
          opcoes.aoBreakpoints?.([], true);
        }
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
      }
      view.focus();
      return true;
    },
  };
  notificarEstado();
  return api;
}
