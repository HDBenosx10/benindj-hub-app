"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify, inspect } = require("node:util");
const { prepararPasta, confere } = require("./projetos.cjs");
const executar = promisify(execFile);

async function comando(pasta, definicao) {
  let binario = definicao.bin;
  let argumentos = definicao.args;
  if (binario === "node") {
    binario = process.execPath;
  }
  if (binario === "npm") {
    const portatil = path.join(
      process.env.LAB_RUNTIME_DIR ?? path.join(__dirname, "runtime"),
      "npm",
      "bin",
      "npm-cli.js",
    );
    let npm = portatil;
    try {
      await fs.access(npm);
    } catch {
      npm = path.join(
        path.dirname(process.execPath),
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      );
    }
    binario = process.execPath;
    argumentos = [npm, ...argumentos];
  }
  const env = {
    ...process.env,
    PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
  };
  try {
    const retorno = await executar(binario, argumentos, {
      cwd: pasta,
      env,
      encoding: "utf8",
      timeout: 6000,
      maxBuffer: 200000,
      windowsHide: true,
    });
    if (definicao.bin === "git" && definicao.args[0] === "init") {
      for (const [chave, valor] of [
        ["user.name", "Aluno do laboratório"],
        ["user.email", "aluno@example.invalid"],
        ["commit.gpgsign", "false"],
        ["core.autocrlf", "false"],
      ]) {
        await executar("git", ["config", "--local", chave, valor], {
          cwd: pasta,
          windowsHide: true,
        });
      }
    }
    return {
      comando: definicao.texto,
      saida: retorno.stdout,
      aviso: retorno.stderr,
      codigo: 0,
    };
  } catch (erro) {
    return {
      comando: definicao.texto,
      saida: erro.stdout ?? "",
      aviso:
        erro.code === "ENOENT"
          ? "Git não está disponível neste computador. A oficina de Git requer essa ferramenta."
          : (erro.stderr ?? erro.message),
      codigo: typeof erro.code === "number" ? erro.code : 1,
    };
  }
}

function ultimoJson(texto) {
  const linhas = texto.trim().split(/\r?\n/);
  return JSON.parse(linhas[linhas.length - 1]);
}

async function testarOficina(aula, arquivos, pastaGit) {
  const resultados = [];
  for (const teste of aula.projeto.testes) {
    const temporaria = aula.projeto.tipo !== "git";
    const pasta = temporaria
      ? await fs.mkdtemp(path.join(os.tmpdir(), "acai-v3-oficina-"))
      : pastaGit;
    let esperado = inspect(teste.esperado, { depth: 5 });
    let recebido = "";
    try {
      await prepararPasta(pasta, arquivos);
      if (teste.git) {
        if (teste.git === "inicial") {
          esperado = "Histórico com uma primeira versão contendo Relatório inicial.";
          const log = await executar("git", ["log", "--reverse", "--format=%H"], {
            cwd: pasta,
            encoding: "utf8",
            windowsHide: true,
          });
          const primeiro = log.stdout.trim().split(/\r?\n/)[0];
          const arquivo = await executar("git", ["show", primeiro + ":main.cjs"], {
            cwd: pasta,
            encoding: "utf8",
            windowsHide: true,
          });
          if (!arquivo.stdout.includes("Relatório inicial")) {
            throw new Error(
              "A primeira versão precisa representar o relatório inicial.",
            );
          }
          recebido = "Primeiro commit encontrado e seu conteúdo conferido.";
        } else {
          esperado =
            "Branch melhoria-relatorio com ao menos dois commits e mensagem atualizada.";
          const branch = await executar("git", ["branch", "--show-current"], {
            cwd: pasta,
            encoding: "utf8",
            windowsHide: true,
          });
          const total = await executar("git", ["rev-list", "--count", "HEAD"], {
            cwd: pasta,
            encoding: "utf8",
            windowsHide: true,
          });
          const head = await executar("git", ["show", "HEAD:main.cjs"], {
            cwd: pasta,
            encoding: "utf8",
            windowsHide: true,
          });
          if (
            branch.stdout.trim() !== "melhoria-relatorio" ||
            Number(total.stdout.trim()) < 2 ||
            !head.stdout.includes("Relatório atualizado")
          ) {
            throw new Error("Registre a melhoria na branch depois da primeira versão.");
          }
          recebido = branch.stdout + total.stdout + head.stdout;
        }
      } else {
        const definicao = teste.script
          ? {
              bin: "node",
              args: ["-e", teste.script],
              texto: "node (cenário de verificação)",
            }
          : aula.projeto.comandos.find((item) => item.id === teste.comando);
        let retorno = await comando(pasta, definicao);
        if (retorno.codigo !== 0) {
          throw new Error(retorno.aviso || retorno.saida);
        }
        if (teste.repetir) {
          retorno = await comando(pasta, definicao);
        }
        if (retorno.codigo !== 0) {
          throw new Error(retorno.aviso || retorno.saida);
        }
        const valor = ultimoJson(retorno.saida);
        recebido = inspect(valor, { depth: 5 });
        if (!confere(valor, teste.esperado)) {
          throw new Error("A saída do programa não corresponde ao contrato.");
        }
        if (teste.arquivo) {
          const conteudo = await fs.readFile(path.join(pasta, teste.arquivo), "utf8");
          JSON.parse(conteudo);
          recebido += "\n\nArquivo real gravado: " + teste.arquivo + "\n" + conteudo;
        }
      }
      resultados.push({
        nome: teste.nome,
        passou: true,
        esperado,
        recebido,
        registros: [],
      });
    } catch (erro) {
      resultados.push({
        nome: teste.nome,
        passou: false,
        esperado,
        recebido: erro.message + (recebido ? "\n" + recebido : ""),
        registros: [],
      });
    } finally {
      if (temporaria) {
        const destino = path.resolve(pasta);
        if (
          !destino.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
          !path.basename(destino).startsWith("acai-v3-oficina-")
        ) {
          throw new Error("Diretório de teste inesperado.");
        }
        await fs.rm(destino, { recursive: true, force: true });
      }
    }
  }
  return resultados;
}

module.exports = { comando, testarOficina };
