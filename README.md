# Ateliê Açaí — aplicativo

Aplicativo Electron para aprender JavaScript com explicações, código colorido, execução livre e verificações de comportamento. Windows x64. A edição do aluno recebe somente as aulas liberadas.

## Usar como aluno

Baixe `Atelie-Acai-Aluno-0.5.0-Windows-x64.exe` na release e abra com dois cliques. Não precisa instalar Node, npm ou Electron, nem abrir terminal. A aula inicial de arrays de objetos contém seis desafios. Use **Importar arquivo** para receber novas aulas `.aula-acai` ou arquivos antigos `.acai.json`.

As respostas ficam em `%APPDATA%/Ateliê Açaí Aluno`, fora do executável. Substituir o `.exe` por uma versão nova preserva esse diretório. **Baixar respostas** exporta uma cópia para entregar ao professor.

O executável portátil não registra uma extensão no Windows. Importe a aula pelo aplicativo ou arraste o arquivo `.aula-acai` sobre o executável. Se o sistema já associar a extensão ao app, a abertura também é tratada. Não se associa a extensão genérica `.json`.

## Estrutura e separação

- `desktop/`: janela Electron, processo principal e preload restrito.
- `engine/`: motor comum e interface; execução das atividades em workers.
- `aulas/aula-12.aula-acai`: única aula pública inicial, sem gabaritos.
- `scripts/`: preparação, montagem, conferência do pacote e checksums.
- `tests/`: testes do motor e da projeção pública.
- `.github/workflows/release.yml`: teste, build Windows e rascunho de release por tag.

O acervo completo, gabaritos e autoria por GPT pertencem ao repositório separado **atelie-acai-professor**, que deve ser privado. O build do aluno usa uma lista de arquivos públicos, e `check-package.cjs` confere a separação depois da montagem.

## Desenvolver

Somente quem desenvolve o app precisa de Node 24 e Git. O aluno e o professor que usam os executáveis não precisam desse setup.

```sh
npm ci
npm test
npm start
npm run build
```

`npm run build` gera o executável portátil em `dist/`. `npm run build:dir` gera a pasta de diagnóstico. O runtime Node é obtido do site oficial durante a preparação e acompanha a aplicação, inclusive npm para as oficinas. A oficina de Git continua exigindo Git no computador do aluno; isso não é necessário para abrir o aplicativo.

O build requer Windows x64. As dependências estão fixadas no `package-lock.json`; o Node embarcado está fixado em `scripts/prepare.cjs`. Não versione `.cache`, `.build`, `dist`, respostas nem credenciais.

## Publicar no GitHub

Crie um repositório vazio, preferencialmente com este nome, e envie os arquivos desta pasta. Não inclua a pasta do professor.

```sh
git init -b main
git add .
git commit -m "Aplicativo Electron e laboratório inicial"
git remote add origin https://github.com/HDBenosx10/atelie-acai-app.git
git push -u origin main
git tag v0.5.0
git push origin v0.5.0
```

O workflow confere se a tag corresponde à versão de `package.json`, executa os testes, monta o `.exe`, verifica a ausência do conteúdo privado e cria **um rascunho de release** com o executável e `SHA256SUMS.txt`. Revise os arquivos e publique o rascunho pelo GitHub. Antes de uma nova tag, atualize a versão com `npm version patch --no-git-tag-version`, teste e faça o commit.

Os executáveis desta entrega não têm assinatura digital. A assinatura de código e a atualização automática não estão configuradas. O fluxo atual é baixar uma nova release e substituir o `.exe`, mantendo os dados. Veja [a orientação oficial de distribuição do Electron](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging).

## Limites importantes

O programa executa JavaScript local do aluno com recursos do Node para permitir arquivos, módulos, HTTP e SQLite. Workers limitam duração e separam a execução da interface, mas não são uma barreira de segurança para código hostil. O motor escuta somente em loopback. A janela usa `nodeIntegration: false`, isolamento de contexto, sandbox do renderer, CSP e navegação restrita.

O acervo continua no schema 3 para aceitar aulas e respostas anteriores. O aplicativo é versão 0.5.0. Os diretórios de dados das duas edições são distintos.
