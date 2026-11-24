# BeninDJ Hub · Aluno

Laboratório de JavaScript para Windows. Abra o executável e entre na aula. **Executar** permite explorar seu código; **Verificar** confere os critérios da atividade.

O aplicativo começa somente com a **aula 0 — Hello world!**. Para receber outra aula, use **Importar aula** com o arquivo `.aula-hub` enviado pelo professor. O aluno não instala Node nem usa terminal para abrir o aplicativo.

As respostas ficam salvas automaticamente no computador, fora do executável. A atualização migra os dados do perfil anterior sem sobrescrever respostas existentes.

## Gerar uma versão

No GitHub, abra **Actions → Gerar versão Windows → Run workflow**. Informe uma versão inédita, como `0.9.0`. O padrão cria uma release em rascunho; marque **publicar** para disponibilizá-la ao terminar.

A esteira executa testes, monta o aplicativo, confere que apenas a aula 0 está incluída, abre o executável e verifica execução, importação e persistência. A release contém o `.exe`, `SHA256SUMS.txt` e `BUILD-INFO.json` com os commits de origem. Para corrigir uma versão, gere outra.

Pushes e pull requests verificam o código sem criar releases. A publicação usa o `GITHUB_TOKEN` fornecido pelo GitHub Actions.

## Desenvolvimento

Requer Windows, Git e Node 24.13 ou superior.

```sh
npm ci
npm start
npm test
npm run build
```

O build baixa o runtime oficial do Node. O executável inclui Node e npm para as oficinas. `.build`, `.cache`, `dist` e `node_modules` são gerados e não entram no Git.

O acervo, os gabaritos e a autoria com DEV Coruja pertencem ao [repositório privado do professor](https://github.com/HDBenosx10/benindj-hub-professor).

## Interface

Paleta baseada no Dracula Pro do proprietário: fundo `#22212C`, navegação `#17161D` e roxo `#9580FF`. Organização inspirada na referência [Northflank](https://www.behance.net/gallery/174352873/Northflank-Cloud-Platform). Os componentes e ícones são próprios; nenhum pacote do tema privado é distribuído.

## Bancada de back-end

Aulas podem trazer SQLite em memória ou arquivo, documentos JSON locais e mocks HTTP com atraso e sequência de respostas. A aba Ambiente permite consultar e alterar esses recursos, respeitando as permissões da aula. O aluno pode criar recursos adicionais quando autorizado. Fora do Hub exporta código e ambiente para Node, sem gabaritos.

Veja o [guia da bancada](docs/ambientes/README.md) para contratos, limites, testes e execução fora da plataforma. O aplicativo inicial continua incluindo somente Hello World; infraestrutura aparece nas aulas que o professor liberar.

## Trilhas e bancada visual · 0.8

A primeira abertura permite escolher Back-end, Front-end ou IA. Hoje, JavaScript é a linguagem executável; Front-end/IA têm o núcleo comum, com especialização em preparação. Java/Go ficam indisponíveis até a V2. Minha trilha mostra progresso somente das aulas liberadas. O professor continua controlando a distribuição.

[Guia de jornada, recursos e abertura](docs/jornada.md). Para uso diário, prefira o instalador por usuário. A versão portátil continua disponível, com extração a cada abertura. Os arquivos de dados são mantidos fora da instalação.

## Releases oficiais

Uma tag vX.Y.Z aciona testes, montagem e publicação oficial dos pacotes portátil e instalador. A ação manual continua disponível para rascunhos. A release publicada remove somente rascunhos antigos; o histórico Git e as releases publicadas anteriores são preservados.

## Editor 0.10 e saves

O laboratório usa CodeMirror com parser JavaScript, destaque para JSON/SQL e paleta consultada no Dracula Pro. **Formatar** ou **Shift+Alt+F** organiza JavaScript/JSON com Prettier offline. Ctrl+Z desfaz a operação; erros de sintaxe preservam o texto. [Guia do editor e das atualizações](docs/editor-e-atualizacoes.md).

Portátil e instalador preservam respostas no perfil do usuário, fora do executável. A esteira de release testa a passagem da versão 0.9 para a nova versão usando um perfil temporário.
