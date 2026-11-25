const { test } = require("node:test");
const assert = require("node:assert/strict");
const conteudo = require("../engine/conteudo.js");
const jornada = require("../engine/jornada.cjs");
const c = () => ({
  versao: 1,
  assinaturas: ["somar(valores)"],
  parametros: [
    { nome: "valores", tipo: "number[]", descricao: "Números a somar." },
  ],
  retorno: {
    tipo: "number",
    descricao: "Soma dos valores, ou zero para lista vazia.",
  },
  regras: ["Preserve a lista."],
  exemplos: [
    {
      entrada: "somar([2, 3])",
      saida: "5",
      explicacao: "Dois valores somados.",
    },
  ],
  guia: [
    { titulo: "Prever", texto: "Compare os dois valores com a soma esperada." },
  ],
});
test("Contrato exige parâmetros descritos e exemplos explícitos de entrada e saída", () => {
  assert.doesNotThrow(() => conteudo.validarContrato(c()));
  const errado = c();
  delete errado.exemplos[0].saida;
  assert.throws(() => conteudo.validarContrato(errado), /contrato/);
  const vazio = c();
  vazio.parametros[0].descricao = "";
  assert.throws(() => conteudo.validarContrato(vazio), /contrato/);
});
test("Aula antiga continua legível sem transformar corpo de teste em entrada", () => {
  assert.doesNotThrow(() => conteudo.validar({ conceitos: ["Texto antigo"] }));
  const legado = conteudo.contrato({
    enunciado: "Some valores",
    testes: [{ executar: "return apoio.lerSaida();" }],
  });
  assert.equal(legado.legado, true);
  assert.deepEqual(legado.exemplos, []);
  assert.equal(
    conteudo.estudo({ conceitos: ["Um conceito"] })[0].paragrafos[0],
    "Um conceito",
  );
});
test("Reorganizar leitura preserva aprovação existente; mudar critério ainda exige verificar", () => {
  const aula = {
    modo: "funcoes",
    exercicios: [
      {
        id: "soma",
        enunciado: "Some valores",
        testes: [
          {
            nome: "Dois valores",
            executar: "return somar([2,3]);",
            esperado: 5,
          },
        ],
      },
    ],
  };
  const salvo = { codigos: { soma: "function somar(v){return v[0]+v[1]}" } };
  jornada.registrar(
    aula,
    salvo,
    [{ exercicioId: "soma", passou: true }],
    "soma",
  );
  const assinatura = salvo.progresso.soma;
  aula.estudo = [
    { titulo: "Acumulação", paragrafos: ["Uma explicação reorganizada"] },
  ];
  aula.exercicios[0].contrato = c();
  assert.equal(jornada.resumo(aula, salvo).completa, true);
  assert.equal(salvo.progresso.soma, assinatura);
  aula.exercicios[0].testes[0].esperado = 6;
  assert.equal(jornada.resumo(aula, salvo).completa, false);
});
