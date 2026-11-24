# BeninDJ Hub · Aluno

Laboratório de JavaScript para Windows. Abra o executável e entre na aula. **Executar** permite explorar seu código; **Verificar** confere os critérios da atividade.

O aplicativo começa somente com a **aula 0 — Hello world!**. Para receber outra aula, use **Importar aula** com o arquivo `.aula-hub` enviado pelo professor. O aluno não instala Node nem usa terminal para abrir o aplicativo.

As respostas ficam salvas automaticamente no computador, fora do executável. A atualização migra os dados do perfil anterior sem sobrescrever respostas existentes.

## Gerar uma versão

No GitHub, abra **Actions → Gerar versão Windows → Run workflow**. Informe uma versão inédita, como `0.7.0`. O padrão cria uma release em rascunho; marque **publicar** para disponibilizá-la ao terminar.

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
