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
  if (
    [
      "desestruturacao-objeto",
      "desestruturacao-com-padrao",
      "rest-parametro",
      "rest-objeto",
      "rest-array",
      "spread-objeto",
    ].includes(regra)
  ) {
    let encontrou =
      regra === "rest-parametro" &&
      alvo.params.some((p) => p.type === "RestElement");
    const conferir = (n) => {
      if (n.type === "ObjectPattern") {
        if (regra === "desestruturacao-objeto") encontrou = true;
        if (
          regra === "desestruturacao-com-padrao" &&
          n.properties.some(
            (p) =>
              p.type === "Property" && p.value?.type === "AssignmentPattern",
          )
        )
          encontrou = true;
        if (
          regra === "rest-objeto" &&
          n.properties.some((p) => p.type === "RestElement")
        )
          encontrou = true;
      }
      if (
        regra === "rest-array" &&
        n.type === "ArrayPattern" &&
        n.elements.some((p) => p?.type === "RestElement")
      )
        encontrou = true;
      if (
        regra === "spread-objeto" &&
        n.type === "ObjectExpression" &&
        n.properties.some((p) => p.type === "SpreadElement")
      )
        encontrou = true;
    };
    visitar(alvo.body, conferir);
    for (const p of alvo.params) visitar(p, conferir);
    return {
      passou: encontrou,
      mensagem: encontrou
        ? "Estrutura técnica encontrada. Confira também o comportamento e o fluxo com o professor."
        : `Use ${tecnicasDisponiveis[regra]} na própria função ${requisito.funcao}.`,
    };
  }
  if (regra.startsWith("sem-metodo-")) {
    const proibido = regra.slice("sem-metodo-".length);
    let encontrou = false;
    visitar(
      alvo.body,
      (n) => {
        if (n.type !== "CallExpression" || n.callee.type !== "MemberExpression")
          return;
        const nome = n.callee.computed
          ? n.callee.property.value
          : n.callee.property.name;
        if (nome === proibido) encontrou = true;
      },
      true,
    );
    return {
      passou: !encontrou,
      mensagem: encontrou
        ? `A função ${requisito.funcao} não deve chamar ${proibido}, inclusive em funções auxiliares internas.`
        : `Nenhuma chamada direta de ${proibido} foi encontrada. Os testes de comportamento são avaliados separadamente.`,
    };
  }
  let passou = {
    arrow: alvo.type === "ArrowFunctionExpression",
    declaracao: alvo.type === "FunctionDeclaration",
    expressao: alvo.type === "FunctionExpression",
    async: alvo.async === true,
  }[regra];
  if (regra === "parametro-padrao")
    passou = alvo.params.some(
      (p) =>
        p.type === "AssignmentPattern" &&
        p.left.type === "Identifier" &&
        p.left.name === requisito.parametro,
    );
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
    const internas = new Set();
    const retornadas = new Set();
    let retornaFuncaoDireta = ehFuncao(alvo.body);
    const observarRetorno = (no) => {
      if (!no) return;
      if (ehFuncao(no)) retornaFuncaoDireta = true;
      else if (no.type === "Identifier") retornadas.add(no.name);
      else if (no.type === "ConditionalExpression") {
        observarRetorno(no.consequent);
        observarRetorno(no.alternate);
      } else if (no.type === "LogicalExpression") {
        observarRetorno(no.left);
        observarRetorno(no.right);
      } else if (no.type === "SequenceExpression")
        observarRetorno(no.expressions.at(-1));
    };
    // Não contar funções decorativas nem helpers não relacionados. O contrato
    // pede a técnica no corpo da função-alvo; delegação é uma regra diferente.
    visitar(alvo.body, (n) => {
      if (n.type === "ReturnStatement" && n.argument) {
        observarRetorno(n.argument);
      }
      if (n.type === "FunctionDeclaration" && n.id) internas.add(n.id.name);
      if (
        n.type === "VariableDeclarator" &&
        n.id.type === "Identifier" &&
        ehFuncao(n.init)
      )
        internas.add(n.id.name);
      if (n.type === "CallExpression" && n.callee.type === "Identifier")
        chamadas.add(n.callee.name);
      if (
        regra === "chama-funcao" &&
        n.type === "CallExpression" &&
        n.callee.type === "Identifier" &&
        n.callee.name === requisito.referencia
      )
        passou = true;
      const ehLaco = (node) =>
        [
          "ForStatement",
          "ForOfStatement",
          "ForInStatement",
          "WhileStatement",
          "DoWhileStatement",
        ].includes(node.type);
      if (regra === "laco" && ehLaco(n)) passou = true;
      if (regra === "lacos-aninhados" && ehLaco(n))
        visitar(n.body, (interno) => {
          if (ehLaco(interno)) passou = true;
        });
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
    if (regra === "funcao-interna-chamada")
      passou = [...internas].some(
        (nome) =>
          chamadas.has(nome) &&
          (!requisito.referencia || nome === requisito.referencia),
      );
    if (regra === "funcao-interna-retornada")
      passou =
        retornaFuncaoDireta ||
        [...internas].some((nome) => retornadas.has(nome));
  }
  return {
    passou,
    mensagem: passou
      ? "Estrutura técnica encontrada. Os testes de comportamento são avaliados separadamente."
      : regra === "parametro-padrao"
        ? `Declare o valor padrão do parâmetro ${requisito.parametro} na assinatura de ${requisito.funcao}.`
        : regra === "chama-funcao"
          ? `A função ${requisito.funcao} deve chamar a auxiliar ${requisito.referencia} no próprio corpo.`
          : `A função ${requisito.funcao} deve usar ${tecnicasDisponiveis[regra]}${requisito.referencia ? " · " + requisito.referencia : ""}${["arrow", "declaracao", "expressao", "async"].includes(regra) ? "." : " no próprio corpo, sem contar funções internas auxiliares."}`,
  };
}
module.exports = { analisar, conferirArvore };
