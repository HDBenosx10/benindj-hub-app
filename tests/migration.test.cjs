const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { migrarPerfil } = require("../desktop/migrate-profile.cjs");
test("migração preserva respostas antigas e não sobrescreve dados novos", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "hub-migracao-"));
  const antigo = path.join(base, "Ateliê Açaí Aluno", ".dados");
  const novo = path.join(base, "BeninDJ Hub Aluno");
  try {
    await fs.mkdir(antigo, { recursive: true });
    await fs.writeFile(path.join(antigo, "respostas.json"), "resposta antiga");
    assert.equal(await migrarPerfil(base, "aluno", novo), true);
    assert.equal(
      await fs.readFile(path.join(novo, ".dados", "respostas.json"), "utf8"),
      "resposta antiga",
    );
    await fs.writeFile(
      path.join(novo, ".dados", "respostas.json"),
      "resposta nova",
    );
    assert.equal(await migrarPerfil(base, "aluno", novo), false);
    assert.equal(
      await fs.readFile(path.join(novo, ".dados", "respostas.json"), "utf8"),
      "resposta nova",
    );
  } finally {
    assert.ok(base.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(base, { recursive: true, force: true });
  }
});
