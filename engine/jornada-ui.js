"use strict";
let dadosJornada,
  bibliotecaCompleta = [],
  recursoSelecionado = null;
function focarPratica(foco) {
  document.body.dataset.foco = foco;
  document
    .querySelectorAll("[data-foco]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.foco === foco)),
    );
  if (foco === "testes") $("verificacoes").open = true;
  if (foco === "execucao" && aula?.modo === "funcoes")
    $("meus-experimentos").open = true;
}
document
  .querySelectorAll("[data-foco]")
  .forEach((b) => (b.onclick = () => focarPratica(b.dataset.foco)));
focarPratica("codigo");

function barraProgresso(parent, valor, texto) {
  const linha = elemento(parent, "div", undefined, "journey-meter");
  elemento(linha, "span", texto);
  const progress = elemento(linha, "progress");
  progress.max = 100;
  progress.value = valor;
  progress.setAttribute("aria-label", texto);
}
function renderizarJornada() {
  renderizarPercursos();
}
function abrirEscolhaJornada() {
  if (document.querySelector("#escolha-jornada")) return;
  const dialogo = elemento(document.body, "dialog");
  dialogo.id = "escolha-jornada";
  dialogo.className = "journey-dialog";
  const form = elemento(dialogo, "form");
  elemento(form, "p", "BEM-VINDO AO BENINDJ HUB", "eyebrow");
  elemento(form, "h2", "Seus objetivos de estudo");
  elemento(
    form,
    "p",
    "Escolha sua área de interesse. Isso ajuda a encontrar percursos do professor e não libera aulas. Você pode mudar depois.",
  );
  const trilhas = elemento(form, "fieldset");
  elemento(trilhas, "legend", "Área de interesse");
  for (const t of dadosJornada.trilhas) {
    const label = elemento(trilhas, "label", undefined, "track-choice");
    const radio = elemento(label, "input");
    radio.type = "radio";
    radio.name = "trilha";
    radio.value = t.id;
    radio.required = true;
    radio.checked = t.id === (dadosJornada.escolha?.trilha ?? "backend");
    const texto = elemento(label, "div");
    elemento(texto, "strong", t.nome);
    elemento(texto, "p", t.descricao);
  }
  const label = elemento(form, "label", "Linguagem principal", "campo");
  const select = elemento(label, "select");
  select.setAttribute("aria-label", "Linguagem principal");
  for (const l of dadosJornada.linguagens) {
    const o = elemento(
      select,
      "option",
      l.nome + (l.disponivel ? " · Disponível" : " · V2, ainda indisponível"),
    );
    o.value = l.id;
    o.disabled = !l.disponivel;
  }
  elemento(
    form,
    "p",
    "Hoje o aplicativo executa JavaScript. Java e Go precisam de novos runtimes e não podem ser usados nesta versão.",
    "secondary",
  );
  const erro = elemento(form, "p");
  erro.setAttribute("role", "alert");
  const salvar = elemento(form, "button", "Salvar meus objetivos", "primary");
  salvar.type = "submit";
  if (dadosJornada.escolha)
    botao(form, "Cancelar", () => {
      dialogo.close();
      dialogo.remove();
    });
  dialogo.addEventListener("cancel", (e) => {
    if (!dadosJornada.escolha) e.preventDefault();
    else dialogo.remove();
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    salvar.disabled = true;
    try {
      await api("/api/jornada", {
        trilha: form.elements.trilha.value,
        linguagem: select.value,
      });
      dialogo.close();
      dialogo.remove();
      await carregarInicio();
      renderizarJornada();
      mostrarRota("jornada");
    } catch (e) {
      erro.textContent = e.message;
    } finally {
      salvar.disabled = false;
    }
  };
  dialogo.showModal();
}
function renderizarProgressoAula() {
  if (!aula) return;
  const p = biblioteca.find((a) => a.id === aula.id)?.progresso;
  const raiz = $("progresso-aula");
  raiz.replaceChildren();
  if (p)
    barraProgresso(
      raiz,
      p.percentual,
      `${p.completa ? "✓ Aula concluída" : "Seu progresso"} · ${p.concluidos}/${p.total} desafios validados`,
    );
}
function celebrarProgresso(antes, depois) {
  if (!depois || depois.concluidos <= (antes?.concluidos ?? 0)) return;
  const d = elemento(document.body, "dialog", undefined, "completion-dialog");
  const simbolo = elemento(d, "div", "✓", "completion-symbol");
  simbolo.setAttribute("aria-hidden", "true");
  elemento(d, "h2", depois.completa ? "Aula concluída!" : "Desafio concluído!");
  elemento(
    d,
    "p",
    depois.completa
      ? "Você fez todos os desafios passarem. Explique sua solução e escolha seu próximo passo."
      : `${depois.concluidos} de ${depois.total} desafios validados. Seu progresso está salvo.`,
  );
  const fechar = () => {
    d.close();
    d.remove();
  };
  botao(d, "Continuar explorando", fechar);
  const proxima = depois.completa
    ? biblioteca.find((a) => a.numero > aula.numero && !a.progresso?.completa)
    : null;
  if (proxima)
    botao(
      d,
      "Próxima aula disponível →",
      async () => {
        fechar();
        await abrirAula(proxima.id);
      },
      "primary",
    );
  else if (depois.completa)
    elemento(
      d,
      "p",
      "Se não houver próxima aula disponível, seu professor poderá liberar a continuação.",
    );
  if (
    !depois.completa &&
    aula.modo === "funcoes" &&
    exercicioAtual < aula.exercicios.length - 1
  )
    botao(
      d,
      "Próximo desafio →",
      () => {
        fechar();
        exercicioAtual++;
        renderizarPratica();
      },
      "primary",
    );
  d.addEventListener("cancel", () => d.remove());
  d.showModal();
}

function renderizarMapaRecursos() {
  const nav = $("nav-recursos"),
    mapa = $("mapa-recursos");
  nav.replaceChildren();
  mapa.replaceChildren();
  const recursos = estadoBancada?.recursos ?? aula?.ambiente?.recursos ?? [];
  nav.hidden = !aula?.ambiente;
  mapa.hidden = !aula?.ambiente;
  if (!aula?.ambiente) return;
  elemento(nav, "p", "RECURSOS DESTA AULA", "nav-caption");
  botao(nav, "◇ Mapa do ambiente", () => abrirRecursoLateral(null));
  const cabecalho = elemento(mapa, "div", undefined, "resource-map-heading");
  elemento(cabecalho, "strong", "Mapa do ambiente");
  elemento(
    cabecalho,
    "small",
    "Recursos declarados na aula · clique para inspecionar",
  );
  const grafo = elemento(mapa, "div", undefined, "resource-graph");
  const app = botao(
    grafo,
    aula.modo === "projeto" ? "◈ Sua aplicação" : "◈ Seu código",
    () => mostrarAba("praticar"),
    "resource-node app-node",
  );
  elemento(
    app,
    "small",
    apiAtiva
      ? "Servidor iniciado · veja o console"
      : "Execute para observar o comportamento",
  );
  const dependencias = elemento(
    grafo,
    "div",
    undefined,
    "resource-dependencies",
  );
  for (const r of recursos) {
    const icone =
      r.tipo === "sqlite" ? "▤" : r.tipo === "mock-http" ? "⇄" : "▧";
    const tipo =
      r.tipo === "sqlite"
        ? "SQLite"
        : r.tipo === "mock-http"
          ? "Mock de API"
          : "Documentos JSON";
    botao(nav, `${icone} ${r.nome ?? r.id}`, () => abrirRecursoLateral(r.id));
    const b = botao(
      dependencias,
      `${icone} ${r.nome ?? r.id}`,
      () => abrirRecursoLateral(r.id),
      "resource-node",
    );
    elemento(
      b,
      "small",
      `${tipo} · ${estadoBancada ? "Preparado" : "Disponível · inspecionar"}`,
    );
    if (r.tipo === "mock-http")
      elemento(
        b,
        "span",
        `${r.rotas.length} rota(s) · status e atrasos configuráveis`,
      );
    if (r.tipo === "sqlite" && r.tabelas)
      elemento(b, "span", `${r.tabelas.length} tabela(s)`);
  }
  if (aula.ambiente.permitirCriacao)
    botao(nav, "＋ Criar recurso", () => abrirEdicaoRecurso());
}
async function abrirRecursoLateral(id) {
  recursoSelecionado = id;
  abaBancada = id
    ? ((estadoBancada?.recursos ?? aula.ambiente.recursos).find(
        (r) => r.id === id,
      )?.tipo ?? "visao")
    : "visao";
  document.body.classList.add("resource-drawer-open");
  $("ambiente").hidden = false;
  await carregarBancada();
}
