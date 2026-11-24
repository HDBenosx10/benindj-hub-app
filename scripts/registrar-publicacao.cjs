"use strict";
// Comprovante consultável por Git/SSH, sem credenciais HTTP na máquina do professor.
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const repo = process.env.GITHUB_REPOSITORY;
if (!repo || !process.env.GITHUB_ACTIONS)
  throw Error("Execute pela CI do repositório.");
const versao = require("./release-version.cjs").validarVersao(
  process.env.HUB_RELEASE_VERSION ||
    require(path.resolve("package.json")).version,
);
function api(endpoint, metodo = "GET", dado) {
  return JSON.parse(
    execFileSync(
      "gh",
      ["api", endpoint, "--method", metodo, ...(dado ? ["--input", "-"] : [])],
      {
        encoding: "utf8",
        windowsHide: true,
        ...(dado ? { input: JSON.stringify(dado) } : {}),
      },
    ),
  );
}
const release = api(`repos/${repo}/releases/tags/v${versao}`);
if (release.draft || release.prerelease)
  throw Error("A release ainda não é uma publicação oficial estável.");
const perfil = repo.endsWith("-professor") ? "Professor" : "Aluno";
const obrigatorios = [
  `BeninDJ-Hub-${perfil}-${versao}-Windows-x64.exe`,
  `BeninDJ-Hub-${perfil}-${versao}-Instalador-Windows-x64.exe`,
  "SHA256SUMS.txt",
  "BUILD-INFO.json",
];
for (const nome of obrigatorios)
  if (
    !release.assets.some(
      (a) => a.name === nome && a.state === "uploaded" && a.size > 0,
    )
  )
    throw Error("Artefato oficial ausente: " + nome);
const comprovante = {
  versao,
  repositorio: repo,
  release: release.html_url,
  commitFonte: release.target_commitish,
  publicadoEm: release.published_at,
  verificadoEm: new Date().toISOString(),
  artefatos: release.assets.map((a) => ({
    nome: a.name,
    bytes: a.size,
    url: a.browser_download_url,
    digest: a.digest ?? null,
  })),
};
let anterior;
try {
  anterior = api(`repos/${repo}/git/ref/heads/publicacoes`).object.sha;
} catch {}
const arvore = api(`repos/${repo}/git/trees`, "POST", {
  tree: [
    {
      path: "publicacao.json",
      mode: "100644",
      type: "blob",
      content: JSON.stringify(comprovante, null, 2) + "\n",
    },
  ],
});
const commit = api(`repos/${repo}/git/commits`, "POST", {
  message: `Confere publicação oficial v${versao}`,
  tree: arvore.sha,
  parents: anterior ? [anterior] : [],
  author: {
    name: "BeninDJ Hub CI",
    email: "41898282+github-actions[bot]@users.noreply.github.com",
  },
});
if (anterior)
  api(`repos/${repo}/git/refs/heads/publicacoes`, "PATCH", {
    sha: commit.sha,
    force: false,
  });
else
  api(`repos/${repo}/git/refs`, "POST", {
    ref: "refs/heads/publicacoes",
    sha: commit.sha,
  });
console.log("Publicação oficial verificada: " + comprovante.release);
