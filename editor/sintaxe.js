import { createHighlighterCoreSync } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import js from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import sql from "@shikijs/langs/sql";
import tema from "./temas/dracula-pro.json" with { type: "json" };
import { javascriptLanguage } from "@codemirror/lang-javascript";

// Tema original da extensão VS Code 1.1.0 do repositório do professor.
// TextMate resolve escopos e prioridades; não aproximamos tokens por regex.
export const temaOriginal = tema;
export const linguagemJavaScript = javascriptLanguage;
export const cores = {
  fundo: tema.colors["editor.background"],
  texto: tema.colors["editor.foreground"],
  selecao: tema.colors["editor.selectionBackground"],
  comentario: tema.colors["editorLineNumber.foreground"],
  ciano: "#80FFEA",
  verde: "#8AFF80",
  laranja: "#FFCA80",
  rosa: "#FF80BF",
  roxo: "#9580FF",
  vermelho: "#FF9580",
  amarelo: "#FFFF80",
};
export const highlighter = createHighlighterCoreSync({
  themes: [tema],
  langs: [js, json, sql],
  engine: createJavaScriptRegexEngine(),
});
export function classeToken(token) {
  return `tm-${token.color.slice(1).toLowerCase()}-${token.fontStyle || 0}`;
}
export function tokens(codigo, linguagem = "javascript") {
  return highlighter.codeToTokens(codigo, { lang: linguagem, theme: tema.name })
    .tokens;
}
export function escapar(texto) {
  return texto.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function colorirJS(codigo) {
  return tokens(codigo)
    .map((linha) =>
      linha
        .map(
          (t) => `<span class="${classeToken(t)}">${escapar(t.content)}</span>`,
        )
        .join(""),
    )
    .join("\n");
}
export function cssTema() {
  const cores = new Set([
    tema.colors["editor.foreground"],
    ...tema.tokenColors.map((r) => r.settings.foreground).filter(Boolean),
  ]);
  return [...cores]
    .flatMap((cor) =>
      Array.from(
        { length: 8 },
        (_, estilo) =>
          `.tm-${cor.slice(1).toLowerCase()}-${estilo}{color:${cor};font-style:${estilo & 1 ? "italic" : "normal"};font-weight:${estilo & 2 ? "bold" : "normal"};text-decoration:${estilo & 4 ? "underline" : "none"}}`,
      ),
    )
    .join("\n");
}
