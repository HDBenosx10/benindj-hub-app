import { parse } from "acorn";
function arvore(codigo) {
  return parse(codigo, {
    ecmaVersion: "latest",
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
  });
}
export function chamadasDeTeste(codigo, funcao) {
  const chamadas = [];
  try {
    const visitar = (no) => {
      if (!no || typeof no !== "object") return;
      if (
        no.type === "CallExpression" &&
        no.callee.type === "Identifier" &&
        no.callee.name === funcao
      ) {
        const estatico = (n) =>
          n &&
          (n.type === "Literal" ||
            (n.type === "Identifier" &&
              ["undefined", "NaN", "Infinity"].includes(n.name)) ||
            (n.type === "UnaryExpression" && estatico(n.argument)) ||
            (n.type === "ArrayExpression" && n.elements.every(estatico)) ||
            (n.type === "ObjectExpression" &&
              n.properties.every(
                (p) =>
                  p.type === "Property" && !p.computed && estatico(p.value),
              )));
        if (no.arguments.every(estatico))
          chamadas.push(codigo.slice(no.start, no.end));
      }
      for (const v of Object.values(no))
        if (Array.isArray(v)) v.forEach(visitar);
        else if (v && typeof v === "object") visitar(v);
    };
    visitar(arvore(codigo));
  } catch {}
  return [...new Set(chamadas)];
}
export function argumentosChamada(codigo) {
  try {
    const expressao = arvore(codigo).body[0]?.expression;
    const chamada =
      expressao?.type === "AwaitExpression" ? expressao.argument : expressao;
    if (
      chamada?.type !== "CallExpression" ||
      chamada.callee.type !== "Identifier"
    )
      return null;
    return {
      funcao: chamada.callee.name,
      argumentos: chamada.arguments.map((a) => codigo.slice(a.start, a.end)),
    };
  } catch {
    return null;
  }
}
