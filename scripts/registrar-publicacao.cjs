"use strict";
// Comprovante da CI consultável por Git/SSH, sem credencial HTTPS no computador.
const repo = process.env.GITHUB_REPOSITORY,
  token = process.env.GH_TOKEN;
if (!repo || !token || !process.env.GITHUB_ACTIONS)
  throw Error("Execute somente no GitHub Actions.");
async function api(caminho, metodo = "GET", body) {
  const r = await fetch("https://api.github.com/repos/" + repo + caminho, {
    method: metodo,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok)
    throw Object.assign(Error("GitHub respondeu " + r.status), {
      status: r.status,
    });
  return r.json();
}
(async () => {
  const versao = require("./release-version.cjs").validarVersao(
      process.env.HUB_RELEASE_VERSION,
    ),
    branch = "publicacoes";
  try {
    await api("/git/ref/heads/" + branch);
  } catch (e) {
    if (e.status !== 404) throw e;
    await api("/git/refs", "POST", {
      ref: "refs/heads/" + branch,
      sha: process.env.GITHUB_SHA,
    });
  }
  const relatorio = {
    versao,
    perfil: process.env.HUB_PROFILE,
    commit: process.env.GITHUB_SHA,
    status: process.env.HUB_RUN_STATUS,
    runId: process.env.GITHUB_RUN_ID,
    runUrl: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    geradoEm: new Date().toISOString(),
  };
  try {
    const j = await api(
      `/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`,
    );
    relatorio.etapasComFalha = j.jobs.flatMap((j) =>
      j.steps
        .filter((s) => ["failure", "cancelled"].includes(s.conclusion))
        .map((s) => ({ etapa: s.name, conclusao: s.conclusion })),
    );
  } catch {
    relatorio.etapasComFalha = [];
  }
  const arquivo = `versoes/v${versao}.json`;
  let sha;
  try {
    sha = (await api("/contents/" + arquivo + "?ref=" + branch)).sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  await api("/contents/" + arquivo, "PUT", {
    message: `Registra publicação ${versao}: ${relatorio.status}`,
    branch,
    content: Buffer.from(JSON.stringify(relatorio, null, 2) + "\n").toString(
      "base64",
    ),
    ...(sha ? { sha } : {}),
  });
  console.log(
    "Comprovante registrado em publicacoes/" +
      arquivo +
      "; status " +
      relatorio.status +
      ".",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
