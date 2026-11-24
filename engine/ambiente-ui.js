"use strict";
let estadoBancada,
  abaBancada = "visao";

function textoCampo(parent, titulo, valor, alterar, multi = false) {
  const label = elemento(parent, "label", undefined, "campo");
  elemento(label, "span", titulo);
  const input = elemento(label, multi ? "textarea" : "input");
  input.value = valor ?? "";
  if (multi) {
    input.rows = 5;
    input.className = "small-code";
  }
  input.oninput = () => alterar(input.value, input);
  return input;
}
function selecaoCampo(parent, titulo, valor, opcoes, alterar) {
  const label = elemento(parent, "label", undefined, "campo");
  elemento(label, "span", titulo);
  const select = elemento(label, "select");
  for (const [id, nome] of opcoes) {
    const o = elemento(select, "option", nome);
    o.value = id;
  }
  select.value = valor;
  select.onchange = () => alterar(select.value);
  return select;
}
function opcaoCampo(parent, titulo, valor, alterar) {
  const label = elemento(parent, "label", undefined, "check-field");
  const input = elemento(label, "input");
  input.type = "checkbox";
  input.checked = valor;
  input.onchange = () => alterar(input.checked);
  elemento(label, "span", titulo);
  return input;
}
function campoJSON(parent, titulo, valor, alterar) {
  return textoCampo(
    parent,
    titulo,
    fmt(valor),
    (v, input) => {
      try {
        alterar(JSON.parse(v));
        input.setCustomValidity("");
      } catch {
        input.setCustomValidity("Use JSON válido.");
      }
    },
    true,
  );
}
function recursoPadrao(tipo, id) {
  const recurso = {
    id,
    nome: id,
    tipo,
    modo: "memoria",
    preparo: "automatico",
    editavel: true,
    permissoes: { ddl: true, dml: true },
  };
  if (tipo === "sqlite")
    Object.assign(recurso, {
      ddl: "CREATE TABLE itens(id INTEGER PRIMARY KEY, nome TEXT);",
      seed: "INSERT INTO itens VALUES (1, 'Exemplo');",
    });
  if (tipo === "documentos")
    recurso.colecoes = { itens: [{ _id: "1", nome: "Exemplo" }] };
  if (tipo === "mock-http")
    recurso.rotas = [
      {
        metodo: "GET",
        caminho: "/saude",
        status: 200,
        corpo: { ok: true },
        atrasoMs: 0,
      },
    ];
  return recurso;
}
function formularioRecurso(
  parent,
  original,
  salvarRecurso,
  { professor = false, novo = false } = {},
) {
  const recurso = structuredClone(original);
  const form = elemento(parent, "form", undefined, "resource-form");
  const id = textoCampo(
    form,
    "Identificador usado no código",
    recurso.id,
    (v) => (recurso.id = v),
  );
  id.required = true;
  id.pattern = "[a-z][a-z0-9-]{0,39}";
  id.readOnly = !novo;
  textoCampo(
    form,
    "Nome para exibir",
    recurso.nome ?? recurso.id,
    (v) => (recurso.nome = v),
  );
  if (recurso.tipo !== "mock-http") {
    selecaoCampo(
      form,
      "Armazenamento",
      recurso.modo ?? "memoria",
      [
        ["memoria", "Em memória · perde dados ao encerrar"],
        ["arquivo", "Em arquivo · preserva dados neste computador"],
      ],
      (v) => (recurso.modo = v),
    );
    selecaoCampo(
      form,
      "Ponto de partida",
      recurso.preparo ?? "automatico",
      [
        ["automatico", "Preparar com a estrutura e os dados abaixo"],
        ["aluno", "Começar vazio · o aluno constrói"],
      ],
      (v) => (recurso.preparo = v),
    );
  }
  if (professor)
    opcaoCampo(
      form,
      "Permitir que o aluno edite a configuração deste recurso",
      Boolean(recurso.editavel),
      (v) => (recurso.editavel = v),
    );
  recurso.permissoes ??= {};
  if (recurso.tipo === "sqlite") {
    opcaoCampo(
      form,
      "Permitir DDL: CREATE, ALTER e DROP",
      recurso.permissoes.ddl !== false,
      (v) => (recurso.permissoes.ddl = v),
    );
    opcaoCampo(
      form,
      "Permitir DML: INSERT, UPDATE e DELETE",
      recurso.permissoes.dml !== false,
      (v) => (recurso.permissoes.dml = v),
    );
    textoCampo(
      form,
      "Estrutura inicial · SQL (DDL)",
      recurso.ddl,
      (v) => (recurso.ddl = v),
      true,
    );
    textoCampo(
      form,
      "Dados iniciais · SQL (DML)",
      recurso.seed,
      (v) => (recurso.seed = v),
      true,
    );
    elemento(
      form,
      "p",
      "No modo vazio, esses scripts não executam. Em arquivo, mudar o script não apaga nem recria o banco: use Restaurar dados iniciais se necessário.",
      "secondary",
    );
  } else if (recurso.tipo === "documentos") {
    opcaoCampo(
      form,
      "Permitir inserir, atualizar e remover documentos",
      recurso.permissoes.dml !== false,
      (v) => (recurso.permissoes.dml = v),
    );
    campoJSON(
      form,
      "Coleções iniciais · objeto com arrays de documentos",
      recurso.colecoes ?? {},
      (v) => (recurso.colecoes = v),
    );
    elemento(
      form,
      "p",
      "Documentos JSON locais. Busca por igualdade e operadores $gt, $gte, $lt, $lte, $ne e $in. Não é um servidor MongoDB.",
      "secondary",
    );
  } else {
    const rotas = elemento(form, "div");
    function desenharRotas() {
      rotas.replaceChildren();
      (recurso.rotas ??= []).forEach((rota, i) => {
        const bloco = elemento(rotas, "details", undefined, "desafio-form");
        bloco.open = true;
        elemento(bloco, "summary", `${rota.metodo} ${rota.caminho}`);
        selecaoCampo(
          bloco,
          "Método da rota " + (i + 1),
          rota.metodo,
          ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(
            (v) => [v, v],
          ),
          (v) => (rota.metodo = v),
        );
        textoCampo(
          bloco,
          "Caminho da rota " + (i + 1),
          rota.caminho,
          (v) => (rota.caminho = v),
        );
        textoCampo(
          bloco,
          "Status HTTP " + (i + 1),
          rota.status ?? 200,
          (v) => (rota.status = Number(v)),
        );
        textoCampo(
          bloco,
          "Atraso em milissegundos " + (i + 1),
          rota.atrasoMs ?? 0,
          (v) => (rota.atrasoMs = Number(v)),
        );
        campoJSON(
          bloco,
          "Corpo JSON da resposta " + (i + 1),
          rota.corpo ?? null,
          (v) => (rota.corpo = v),
        );
        const avancado = elemento(bloco, "details");
        elemento(avancado, "summary", "Headers e sequência de respostas");
        campoJSON(
          avancado,
          "Headers de resposta " + (i + 1),
          rota.headers ?? {},
          (v) => (rota.headers = v),
        );
        campoJSON(
          avancado,
          "Sequência opcional: [{status, corpo, atrasoMs}] " + (i + 1),
          rota.sequencia ?? [],
          (v) => {
            if (v.length) rota.sequencia = v;
            else delete rota.sequencia;
          },
        );
        botao(bloco, "Remover rota " + (i + 1), () => {
          recurso.rotas.splice(i, 1);
          desenharRotas();
        });
      });
    }
    desenharRotas();
    botao(form, "＋ Adicionar rota", () => {
      recurso.rotas.push({
        metodo: "GET",
        caminho: "/nova",
        status: 200,
        corpo: { ok: true },
      });
      desenharRotas();
    });
    elemento(
      form,
      "p",
      "A sequência avança a cada requisição e mantém a última resposta. Reiniciar o ambiente reinicia os contadores. O atraso permite exercitar timeout e concorrência.",
      "secondary",
    );
  }
  if (!novo && !professor)
    elemento(
      form,
      "p",
      "Editar a configuração reinicia os recursos em memória. Bancos em arquivo são preservados. Seu código não é alterado.",
      "callout",
    );
  const confirmar = elemento(form, "button", "Salvar recurso", "primary");
  confirmar.type = "submit";
  form
    .querySelectorAll("button:not([type])")
    .forEach((b) => (b.type = "button"));
  form.onsubmit = tratar(async (evento) => {
    evento.preventDefault();
    if (!form.reportValidity()) return;
    confirmar.disabled = true;
    try {
      await salvarRecurso(recurso);
    } finally {
      confirmar.disabled = false;
    }
  });
  return form;
}
async function carregarBancada() {
  if (!aula.ambiente) return;
  estadoBancada = await api("/api/ambiente/estado", { aulaId: aula.id });
  renderizarMapaRecursos();
  desenharBancada();
}
function mostrarTabela(parent, linhas) {
  if (!linhas.length) {
    elemento(parent, "p", "Nenhuma linha retornada.", "secondary");
    return;
  }
  const wrap = elemento(parent, "div", undefined, "table-wrap");
  const tabela = elemento(wrap, "table");
  const chaves = [...new Set(linhas.flatMap((r) => Object.keys(r)))];
  const tr = elemento(elemento(tabela, "thead"), "tr");
  chaves.forEach((k) => elemento(tr, "th", k));
  const tbody = elemento(tabela, "tbody");
  for (const linha of linhas) {
    const tr = elemento(tbody, "tr");
    for (const k of chaves)
      elemento(
        tr,
        "td",
        typeof linha[k] === "object"
          ? fmt(linha[k])
          : String(linha[k] ?? "NULL"),
      );
  }
}
function desenharBancada() {
  const raiz = $("ambiente");
  raiz.replaceChildren();
  if (document.body.classList.contains("resource-drawer-open")) {
    botao(
      raiz,
      "Fechar painel de recursos ×",
      () => {
        document.body.classList.remove("resource-drawer-open");
        raiz.hidden = aba !== "ambiente";
      },
      "drawer-close",
    );
  }
  const topo = card(raiz, "Ambiente desta aula");
  elemento(
    topo,
    "p",
    "Os recursos abaixo pertencem a esta aula. Executar usa este estado; Verificar cria ambientes separados para os testes.",
  );
  const acoes = elemento(topo, "div", undefined, "grupo");
  botao(acoes, "Atualizar estado", carregarBancada);
  botao(acoes, "Reiniciar recursos", async () => {
    if (
      !confirm(
        "Reiniciar os recursos? Bancos em memória e sequências de mocks serão reiniciados. Bancos em arquivo serão preservados.",
      )
    )
      return;
    await api("/api/ambiente/reiniciar", { aulaId: aula.id });
    informarReinicioAmbiente();
    await carregarBancada();
  });
  botao(acoes, "Restaurar dados iniciais", async () => {
    if (
      !confirm(
        "Restaurar os dados iniciais? O estado atual em arquivo será guardado em um backup local. Seu código será preservado.",
      )
    )
      return;
    await api("/api/ambiente/restaurar", { aulaId: aula.id });
    informarReinicioAmbiente();
    await carregarBancada();
  });
  if (estadoBancada.definicao.permitirCriacao)
    botao(acoes, "＋ Novo recurso", () => abrirEdicaoRecurso());
  const nav = elemento(raiz, "nav", undefined, "abas resource-tabs");
  nav.setAttribute("aria-label", "Ferramentas do ambiente");
  for (const [id, nome] of [
    ["visao", "Visão geral"],
    ["sqlite", "SQL"],
    ["documentos", "Documentos"],
    ["mock-http", "APIs simuladas"],
  ]) {
    if (id !== "visao" && !estadoBancada.recursos.some((r) => r.tipo === id))
      continue;
    const b = botao(nav, nome, () => {
      recursoSelecionado = null;
      abaBancada = id;
      desenharBancada();
    });
    b.setAttribute("aria-selected", String(abaBancada === id));
  }
  const recursos = estadoBancada.recursos.filter(
    (r) =>
      (!recursoSelecionado || r.id === recursoSelecionado) &&
      (abaBancada === "visao" || r.tipo === abaBancada),
  );
  if (!recursos.length)
    elemento(
      raiz,
      "p",
      "Nenhum recurso nesta visão. Use Novo recurso se a aula permitir.",
      "empty-state",
    );
  for (const recurso of recursos) {
    const bloco = card(raiz, recurso.nome ?? recurso.id);
    elemento(
      bloco,
      "p",
      `${recurso.id} · ${recurso.tipo} · ${recurso.tipo === "mock-http" ? "HTTP local" : recurso.modo === "arquivo" ? "Persistente em arquivo" : "Em memória"}`,
      "eyebrow",
    );
    if (abaBancada === "visao") {
      if (recurso.tipo === "sqlite")
        elemento(
          bloco,
          "pre",
          (recurso.tabelas ?? []).map((t) => t.sql).join(";\n") ||
            "Banco vazio. Crie suas tabelas na aba SQL.",
          "console",
        );
      if (recurso.tipo === "documentos")
        elemento(
          bloco,
          "p",
          (recurso.colecoesAtuais ?? [])
            .map((c) => `${c.nome}: ${c.total} documentos`)
            .join(" · ") || "Sem coleções. Insira seu primeiro documento.",
        );
      if (recurso.tipo === "mock-http")
        elemento(
          bloco,
          "pre",
          recurso.url +
            "\n" +
            recurso.rotas
              .map((r) => `${r.metodo} ${r.caminho} → ${r.status ?? 200}`)
              .join("\n"),
          "console",
        );
      if (recurso.editavel)
        botao(bloco, "Editar recurso " + recurso.id, () =>
          abrirEdicaoRecurso(recurso.id),
        );
      continue;
    }
    if (abaBancada === "sqlite") {
      const tabelas = elemento(bloco, "div", undefined, "schema-diagram");
      for (const tabela of recurso.tabelas ?? []) {
        const tabelaCard = elemento(
          tabelas,
          "section",
          undefined,
          "schema-table",
        );
        elemento(tabelaCard, "strong", "▤ " + tabela.name);
        for (const coluna of tabela.colunas ?? [])
          elemento(
            tabelaCard,
            "div",
            `${coluna.pk ? "⚿ " : ""}${coluna.name} · ${coluna.type || "sem tipo"}${coluna.notnull ? " · obrigatório" : ""}`,
          );
        for (const fk of tabela.relacoes ?? [])
          elemento(
            tabelaCard,
            "small",
            `${fk.from} → ${fk.table}.${fk.to ?? "chave primária"}`,
          );
        botao(tabelaCard, "Consultar " + tabela.name, () => {
          sql.value =
            'SELECT * FROM "' +
            tabela.name.replaceAll('"', '""') +
            '" LIMIT 100;';
        });
      }
      elemento(
        bloco,
        "p",
        "SELECT consulta; CREATE/ALTER modelam; INSERT/UPDATE/DELETE alteram dados. Use parâmetros para valores. Scripts podem conter várias instruções; use BEGIN/COMMIT para uma transação.",
      );
      const sql = textoCampo(
        bloco,
        "SQL · " + recurso.id,
        "SELECT name, sql FROM sqlite_master WHERE type='table';",
        () => {},
        true,
      );
      const params = textoCampo(
        bloco,
        "Parâmetros JSON · " + recurso.id,
        "[]",
        () => {},
      );
      const botoes = elemento(bloco, "div", undefined, "grupo");
      const saida = elemento(bloco, "div");
      const executar = async (acao) => {
        saida.replaceChildren();
        try {
          const resultado = await api("/api/ambiente/operar", {
            aulaId: aula.id,
            operacao: {
              recurso: recurso.id,
              acao,
              sql: sql.value,
              parametros: JSON.parse(params.value),
            },
          });
          if (resultado.linhas?.length) mostrarTabela(saida, resultado.linhas);
          const resumo =
            resultado.changes !== undefined
              ? `Registros alterados: ${resultado.changes}.`
              : (resultado.aviso ??
                `Linhas retornadas: ${resultado.linhas?.length ?? 0}.${resultado.truncado ? " Exibição limitada a mil linhas." : ""}`);
          elemento(saida, "p", resumo, "secondary");
        } catch (e) {
          elemento(saida, "pre", e.message, "console erro");
        }
      };
      botao(botoes, "Executar SQL", () => executar("sql"), "primary");
      botao(botoes, "Executar script", () => executar("script"));
    } else if (abaBancada === "documentos") {
      elemento(
        bloco,
        "p",
        "Coleções de documentos JSON. O filtro aceita igualdade, $gt, $gte, $lt, $lte, $ne e $in. Atualizar e remover atingem todos os documentos que correspondem ao filtro.",
      );
      const colecao = textoCampo(
        bloco,
        "Coleção · " + recurso.id,
        recurso.colecoesAtuais?.[0]?.nome ?? "itens",
        () => {},
      );
      const filtro = textoCampo(
        bloco,
        "Filtro JSON · " + recurso.id,
        "{}",
        () => {},
        true,
      );
      const documento = textoCampo(
        bloco,
        "Documento ou alterações JSON · " + recurso.id,
        '{"nome":"Novo item"}',
        () => {},
        true,
      );
      const botoes = elemento(bloco, "div", undefined, "grupo");
      const saida = elemento(
        bloco,
        "pre",
        "Envie uma operação para observar os documentos.",
        "console",
      );
      for (const [acao, texto] of [
        ["buscar", "Buscar"],
        ["inserir", "Inserir"],
        ["atualizar", "Atualizar"],
        ["remover", "Remover"],
      ])
        botao(botoes, texto, async () => {
          try {
            saida.textContent = fmt(
              await api("/api/ambiente/operar", {
                aulaId: aula.id,
                operacao: {
                  recurso: recurso.id,
                  acao,
                  colecao: colecao.value,
                  filtro: JSON.parse(filtro.value),
                  documento: JSON.parse(documento.value),
                  alteracoes: JSON.parse(documento.value),
                },
              }),
            );
          } catch (e) {
            saida.textContent = e.message;
          }
        });
    } else {
      elemento(bloco, "pre", recurso.url, "console");
      elemento(
        bloco,
        "p",
        'Use esta URL em fetch ou recursos.url("' +
          recurso.id +
          '"). Os registros abaixo mostram chamadas reais, inclusive tentativas e atrasos.',
      );
      for (const rota of recurso.rotas) {
        const c = card(bloco, `${rota.metodo} ${rota.caminho}`);
        elemento(
          c,
          "p",
          `HTTP ${rota.status ?? 200} · atraso ${rota.atrasoMs ?? 0} ms${rota.sequencia ? " · sequência de respostas" : ""}`,
        );
        elemento(c, "pre", fmt(rota.corpo), "console");
        const retorno = elemento(
          c,
          "pre",
          "Experimente esta rota sem alterar o código do desafio.",
          "console",
        );
        botao(c, "Enviar chamada ao mock", async () => {
          const url = recurso.url + rota.caminho;
          const opcoes = { method: rota.metodo };
          if (!["GET", "HEAD"].includes(rota.metodo))
            Object.assign(opcoes, {
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
          const codigo = `const r = await fetch(${JSON.stringify(url)}, ${JSON.stringify(opcoes)}); console.log("HTTP", r.status); console.log(await r.text());`;
          const resultado = await api("/api/executar", {
            aulaId: aula.id,
            codigo,
          });
          retorno.textContent = [...resultado.saida, resultado.erro ?? ""].join(
            "\n",
          );
        });
      }
      botao(bloco, "Atualizar requisições", carregarBancada);
      elemento(
        bloco,
        "pre",
        fmt(estadoBancada.registros.filter((r) => r.recurso === recurso.id)),
        "console",
      );
      if (recurso.editavel)
        botao(bloco, "Editar recurso " + recurso.id, () =>
          abrirEdicaoRecurso(recurso.id),
        );
    }
  }
}
function abrirEdicaoRecurso(id) {
  const dialog = elemento(
    document.body,
    "dialog",
    undefined,
    "resource-dialog",
  );
  const topo = elemento(dialog, "div", undefined, "dialog-heading");
  elemento(topo, "h2", id ? "Editar recurso" : "Criar um recurso");
  botao(topo, "Fechar", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  const conteudo = elemento(dialog, "div");
  let tipo = "sqlite";
  if (!id)
    selecaoCampo(
      conteudo,
      "Tipo de recurso",
      tipo,
      [
        ["sqlite", "Banco SQL · SQLite"],
        ["documentos", "Documentos JSON · NoSQL local"],
        ["mock-http", "API HTTP simulada"],
      ],
      (v) => {
        tipo = v;
        desenhar();
      },
    );
  const campos = elemento(conteudo, "div");
  function desenhar() {
    campos.replaceChildren();
    let numero = 1;
    while (
      estadoBancada.definicao.recursos.some((r) => r.id === "recurso-" + numero)
    )
      numero++;
    formularioRecurso(
      campos,
      id
        ? estadoBancada.definicao.recursos.find((r) => r.id === id)
        : recursoPadrao(tipo, "recurso-" + numero),
      async (recurso) => {
        const definicao = structuredClone(estadoBancada.definicao);
        definicao.recursos = definicao.recursos.filter((r) => r.id !== id);
        definicao.recursos.push(recurso);
        await api("/api/ambiente/configurar", { aulaId: aula.id, definicao });
        informarReinicioAmbiente();
        dialog.close();
        await carregarBancada();
      },
      { novo: !id },
    );
  }
  desenhar();
  dialog.showModal();
}
function renderizarTransferencia() {
  const raiz = $("transferencia");
  raiz.replaceChildren();
  const material = aula.materiaisComplementares ?? {};
  const topo = card(raiz, "Leve seu projeto para fora do Hub");
  elemento(
    topo,
    "p",
    "Exporte seu código atual e continue em um editor comum. O pacote inclui o ambiente local em JavaScript e os critérios públicos de verificação, sem gabaritos privados.",
  );
  botao(
    topo,
    "↓ Exportar projeto para Node.js",
    async () => {
      await salvar();
      const pacote = await api("/api/exportar-projeto", comDados(), true);
      baixar(pacote, aula.id + "-projeto.zip");
    },
    "primary",
  );
  for (const [titulo, texto] of [
    [
      "Como executar",
      "Instale Node.js 24.13 ou superior, extraia o ZIP, abra a pasta no editor e execute node iniciar.cjs. Use node verificar.cjs para conferir seus resultados. Leia o LEIA-ME.md e os arquivos .hub para entender a orquestração.",
    ],
    [
      "Conceitos e roteiro complementar",
      material.guia ??
        "Explique o caminho de entrada, transformação e saída. Liste o que fica em memória, o que persiste e o que pode falhar. Faça uma mudança por vez e anote uma hipótese antes de executar.",
    ],
    [
      "Construir sem a plataforma",
      material.foraDoHub ??
        "Crie uma pasta vazia, implemente uma operação equivalente usando somente Node.js e escreva um teste com node:test. Documente como outra pessoa pode executar seu projeto.",
    ],
    [
      "Aplicar em outro contexto",
      material.desafiosTransferencia ??
        "Mude o domínio dos dados e reescreva a mesma regra. Inclua um caso inválido e explique por que sua solução funciona.",
    ],
  ])
    elemento(card(raiz, titulo), "p", texto, "material-texto");
  const fontes = card(raiz, "Documentação para continuar");
  for (const fonte of [
    ...(material.referencias ?? []),
    {
      titulo: "Node.js · primeiros passos",
      url: "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs",
    },
    { titulo: "SQLite no Node.js", url: "https://nodejs.org/api/sqlite.html" },
  ]) {
    if (!/^https:\/\//.test(fonte.url)) continue;
    const a = elemento(fontes, "a", fonte.titulo);
    a.href = fonte.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    elemento(fontes, "br");
  }
}

function informarReinicioAmbiente() {
  apiAtiva = false;
  apiDesatualizada = false;
  modoDemo = false;
  $("badge-projeto").textContent = "Parado";
  $("estado-projeto").textContent =
    "Recursos atualizados. Execute o projeto novamente para carregar o ambiente.";
  $("retomar").hidden = true;
  if (aula.modo === "projeto") renderizarEditor();
}
