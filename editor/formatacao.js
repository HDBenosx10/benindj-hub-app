import { formatWithCursor } from "prettier/standalone";
import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";

export function podeFormatar(arquivo) {
  return /\.(?:[cm]?js|json)$/i.test(arquivo);
}
export async function formatarTexto(codigo, arquivo, cursor = 0) {
  if (!podeFormatar(arquivo))
    throw Error("A formatação está disponível para JavaScript e JSON.");
  return formatWithCursor(codigo, {
    parser: /\.json$/i.test(arquivo) ? "json" : "babel",
    plugins: [babel, estree],
    cursorOffset: Math.min(cursor, codigo.length),
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    printWidth: 80,
    endOfLine: "lf",
  });
}
