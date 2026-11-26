"use strict";

const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("./execucao-isolada.cjs");

async function executarNoWorker() {
  const { isDeepStrictEqual, inspect } = require("node:util");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  const apoio = {};
  let analise, erroAnalise;
  if (workerData.testes.some((t) => t.tecnica !== undefined)) {
    try {
      analise = require("./tecnicas.cjs").analisar(workerData.codigo);
    } catch (e) {
      erroAnalise = "Não foi possível analisar a estrutura: " + e.message;
    }
  }

  function mostrar(valor) {
    return inspect(valor, {
      depth: 5,
      maxArrayLength: 30,
      breakLength: 75,
      colors: false,
    }).slice(0, 3000);
  }

  for (let indice = 0; indice < workerData.testes.length; indice++) {
    const teste = workerData.testes[indice];
    const registros = [];
    apoio.lerSaida = () => [...registros];
    const consoleDaAula = {};

    for (const metodo of ["log", "info", "warn", "error", "table"]) {
      consoleDaAula[metodo] = (...valores) => {
        if (registros.length < 20) {
          registros.push(
            valores
              .map((valor) =>
                typeof valor === "string" ? valor : mostrar(valor),
              )
              .join(" ")
              .slice(0, 1500),
          );
        }
      };
    }

    let resultado;

    try {
      if (teste.tecnica !== undefined) {
        const r = erroAnalise
          ? { passou: false, mensagem: erroAnalise }
          : require("./tecnicas.cjs").conferirArvore(analise, teste.tecnica);
        parentPort.postMessage({
          tipo: "resultado",
          resultado: {
            indice,
            nome: teste.nome,
            passou: r.passou,
            esperado: `Técnica ${teste.tecnica.regra} em ${teste.tecnica.funcao}`,
            recebido: r.mensagem,
            registros: [],
          },
        });
        continue;
      }
      const programa = new AsyncFunction(
        "require",
        "console",
        "apoio",
        "recursos",
        workerData.codigo + "\n;\n" + teste.executar,
      );

      const recebido = await programa(
        require,
        consoleDaAula,
        apoio,
        workerData.conexao
          ? require("./recursos-cliente.cjs").criarCliente(workerData.conexao)
          : undefined,
      );
      const esperavaErro = Object.hasOwn(teste, "erroEsperado");

      resultado = {
        indice,
        nome: teste.nome,
        passou: !esperavaErro && isDeepStrictEqual(recebido, teste.esperado),
        esperado: esperavaErro
          ? `Erro: ${teste.erroEsperado}`
          : mostrar(teste.esperado),
        recebido: mostrar(recebido),
        registros,
      };
    } catch (erro) {
      const mensagem = String(erro?.message ?? erro);

      resultado = {
        indice,
        nome: teste.nome,
        passou:
          Object.hasOwn(teste, "erroEsperado") &&
          mensagem === teste.erroEsperado,
        esperado: Object.hasOwn(teste, "erroEsperado")
          ? `Erro: ${teste.erroEsperado}`
          : mostrar(teste.esperado),
        recebido: `${erro?.name ?? "Erro"}: ${mensagem}`,
        registros,
      };
    }

    parentPort.postMessage({ tipo: "resultado", resultado });
  }

  parentPort.postMessage({ tipo: "concluido" });
}

function avaliar(codigo, testes, prazoMs = 5000, conexao) {
  return new Promise((resolve) => {
    const resultados = [];
    let finalizado = false;
    const worker = new Worker(__filename, {
      workerData: { codigo, testes, conexao },
      execArgv: ["--disable-warning=ExperimentalWarning"],
      resourceLimits: { maxOldGenerationSizeMb: 96 },
    });

    async function concluir(mensagem) {
      if (finalizado) {
        return;
      }
      finalizado = true;
      clearTimeout(prazo);
      await worker.terminate();

      for (let indice = resultados.length; indice < testes.length; indice++) {
        resultados.push({
          indice,
          nome: testes[indice].nome,
          passou: false,
          esperado: "Conclusão do teste",
          recebido: mensagem ?? "Teste interrompido.",
          registros: [],
        });
      }
      resolve(resultados);
    }

    const prazo = setTimeout(() => {
      concluir(
        "Tempo esgotado. Confira laços sem fim e Promises que não terminam.",
      );
    }, prazoMs);

    worker.on("message", (mensagem) => {
      if (mensagem.tipo === "resultado") {
        resultados.push(mensagem.resultado);
      }
      if (mensagem.tipo === "concluido") {
        concluir();
      }
    });
    worker.on("error", (erro) =>
      concluir(`Falha ao executar: ${erro.message}`),
    );
    worker.on("exit", (codigoSaida) => {
      if (!finalizado) {
        concluir(
          `O executor encerrou antes de concluir (código ${codigoSaida}).`,
        );
      }
    });
  });
}

if (!isMainThread) {
  executarNoWorker();
}
module.exports = { avaliar };
