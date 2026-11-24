import { javascriptLanguage } from "@codemirror/lang-javascript";
import { HighlightStyle } from "@codemirror/language";
import { highlightTree, tags } from "@lezer/highlight";

// Paleta consultada no Dracula Pro do usuário. As regras do editor são do Hub.
export const cores = {
  fundo: "#22212c",
  texto: "#f8f8f2",
  selecao: "#454158",
  comentario: "#7970a9",
  ciano: "#80ffea",
  verde: "#8aff80",
  laranja: "#ffca80",
  rosa: "#ff80bf",
  roxo: "#9580ff",
  vermelho: "#ff9580",
  amarelo: "#ffff80",
};
export const regras = [
  {
    tag: tags.comment,
    class: "hl-comment",
    color: cores.comentario,
    fontStyle: "italic",
  },
  { tag: tags.keyword, class: "hl-keyword", color: cores.rosa },
  {
    tag: tags.definitionKeyword,
    class: "hl-definition",
    color: cores.ciano,
    fontStyle: "italic",
  },
  { tag: tags.operator, class: "hl-operator", color: cores.rosa },
  {
    tag: [tags.punctuation, tags.bracket],
    class: "hl-punctuation",
    color: cores.texto,
  },
  { tag: [tags.string, tags.regexp], class: "hl-string", color: cores.amarelo },
  { tag: tags.escape, class: "hl-escape", color: cores.rosa },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom],
    class: "hl-number",
    color: cores.roxo,
  },
  { tag: tags.variableName, class: "hl-variable", color: cores.texto },
  {
    tag: [tags.typeName, tags.className],
    class: "hl-type",
    color: cores.ciano,
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    class: "hl-function",
    color: cores.verde,
  },
  { tag: tags.propertyName, class: "hl-property", color: cores.texto },
  {
    tag: [tags.special(tags.variableName), tags.self],
    class: "hl-special",
    color: cores.roxo,
  },
  { tag: tags.invalid, class: "hl-invalid", color: cores.vermelho },
];
export const destaque = HighlightStyle.define(regras);
function escapar(texto) {
  return texto.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function colorirJS(codigo) {
  let fim = 0,
    html = "";
  highlightTree(
    javascriptLanguage.parser.parse(codigo),
    destaque,
    (inicio, final, classes) => {
      html += escapar(codigo.slice(fim, inicio));
      html += `<span class="${classes}">${escapar(codigo.slice(inicio, final))}</span>`;
      fim = final;
    },
  );
  return html + escapar(codigo.slice(fim));
}
