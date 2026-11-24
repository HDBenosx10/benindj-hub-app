const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarVersao } = require("../scripts/release-version.cjs");
test("versões manuais aceitam release e pré-release e rejeitam comandos", () => {
  assert.equal(validarVersao("v0.6.0"), "0.6.0");
  assert.equal(validarVersao("1.2.3-beta.1"), "1.2.3-beta.1");
  for (const valor of [
    "",
    "1.2",
    "01.2.3",
    "1.2.3;git push",
    "1.2.3-01",
    "../../segredo",
  ])
    assert.throws(() => validarVersao(valor));
});
