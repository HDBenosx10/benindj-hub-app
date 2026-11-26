"use strict";
const { parse } = require("acorn");
const { validarTecnica, tecnicasDisponiveis } = require("./conteudo.js");
const ehFuncao = (n) =>
  [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
  ].includes(n?.type);
function visitar(no, fn, entrarEmFuncoes = false) {
  if (!no || typeof no.type !== "string") return;
  fn(no);
  if (ehFuncao(no) && !entrarEmFuncoes) return;
  for (const valor of Object.values(no)) {
    if (Array.isArray(valor))
      valor.forEach((v) => visitar(v, fn, entrarEmFuncoes));
    else if (valor && typeof valor.type === "string")
      visitar(valor, fn, entrarEmFuncoes);
  }
}
function analisar(codigo) {
  return parse(codigo, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
  });
}
function conferirArvore(arvore, requisito) {
  validarTecnica(requisito);
  const candidatos = [];
  for (const n of arvore.body) {
    if (n.type === "FunctionDeclaration" && n.id?.name === requisito.funcao)
      candidatos.push(n);
    if (n.type === "VariableDeclaration")
      for (const d of n.declarations)
        if (
          d.id.type === "Identifier" &&
          d.id.name === requisito.funcao &&
          ehFuncao(d.init)
        )
          candidatos.push(d.init);
  }
  if (candidatos.length !== 1)
    return {
      passou: false,
      mensagem: `Defina ${requisito.funcao} diretamente no código, como uma única declaração de função ou variável com função.`,
    };
  const alvo = candidatos[0];
  const regra = requisito.regra;
  let passou = {
    arrow: alvo.type === "ArrowFunctionExpression",
    declaracao: alvo.type === "FunctionDeclaration",
    expressao: alvo.type === "FunctionExpression",
    async: alvo.async === true,
  }[regra];
  if (passou === undefined) {
    const tipos = {
      for: "ForStatement",
      "for-of": "ForOfStatement",
      while: "WhileStatement",
      "do-while": "DoWhileStatement",
      await: "AwaitExpression",
    };
    passou = false;
    const nomesRecursivos = new Set(
      [requisito.funcao, alvo.id?.name].filter(Boolean),
    );
    const arrows = new Set(),
      chamadas = new Set();
    // Não contar funções decorativas nem helpers não relacionados. O contrato
    // pede a técnica no corpo da função-alvo; delegação é uma regra diferente.
    visitar(alvo.body, (n) => {
      if (n.type === tipos[regra] && !(n.type === "ForOfStatement" && n.await))
        passou = true;
      if (
        regra === "for" &&
        ["ForStatement", "ForOfStatement", "ForInStatement"].includes(n.type)
      )
        passou = true;
      if (regra === "try-catch" && n.type === "TryStatement" && n.handler)
        passou = true;
      if (regra === "finally" && n.type === "TryStatement" && n.finalizer)
        passou = true;
      if (
        regra.startsWith("metodo-") &&
        n.type === "CallExpression" &&
        n.callee.type === "MemberExpression"
      ) {
        const nome = n.callee.computed
          ? n.callee.property.value
          : n.callee.property.name;
        if (nome === regra.slice(7)) passou = true;
      }
      if (regra.startsWith("arrow-interna")) {
        if (
          n.type === "VariableDeclarator" &&
          n.id.type === "Identifier" &&
          n.init?.type === "ArrowFunctionExpression"
        ) {
          if (
            regra === "arrow-interna" ||
            (regra.endsWith("expressao") && n.init.expression) ||
            (regra.endsWith("bloco") && !n.init.expression)
          )
            arrows.add(n.id.name);
        }
        if (n.type === "CallExpression" && n.callee.type === "Identifier")
          chamadas.add(n.callee.name);
      }
      if (
        regra === "recursao" &&
        n.type === "CallExpression" &&
        n.callee.type === "Identifier" &&
        nomesRecursivos.has(n.callee.name)
      )
        passou = true;
    });
    if (regra.startsWith("arrow-interna"))
      passou = [...arrows].some((nome) => chamadas.has(nome));
  }
  return {
    passou,
    mensagem: passou
      ? "Estrutura técnica encontrada. Os testes de comportamento são avaliados separadamente."
      : `A função ${requisito.funcao} deve usar ${tecnicasDisponiveis[regra]}${["arrow", "declaracao", "expressao", "async"].includes(regra) ? "." : " no próprio corpo, sem contar funções internas auxiliares."}`,
  };
}
module.exports = { analisar, conferirArvore };
