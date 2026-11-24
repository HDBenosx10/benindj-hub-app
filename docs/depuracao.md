# Depurar no BeninDJ Hub

Em **Praticar → Editor**, abra **Debug**, na lateral direita. O painel pode ser recolhido sem encerrar a sessão. O debugger executa seu JavaScript no Node incluído no aplicativo; funciona offline e não requer instalar extensões.

1. Escreva seu programa e salve suas entradas em **Chamadas para investigar**. Se o código apenas declara uma função, chame essa função aqui. Esse campo compartilha o rascunho de **Meus experimentos**.
2. Clique na margem à esquerda dos números para marcar um breakpoint. Também é possível informar a linha no painel. Clique no ponto ou no × da lista para remover.
3. Adicione variáveis ou expressões em **Observar expressões**, como `total`, `produto.preco` ou `itens.length`.
4. Clique em **Depurar**. A execução pausa antes da primeira instrução executável. A linha amarela é a próxima instrução, ainda não executada. Declarações sem execução, comentários e linhas vazias podem ser pulados.
5. Avance, compare valores e explique o que mudou. Depois clique em **Parar** para voltar a editar.

| Controle | Atalho | Efeito |
| --- | --- | --- |
| Continuar | F8 | Executa até o próximo breakpoint ou o fim. |
| Pausar | F8 durante execução | Interrompe código em execução para inspecionar. |
| Próxima linha | F10 | Avança sem entrar no corpo das funções chamadas. |
| Entrar | F11 | Entra na função chamada. |
| Sair | Shift+F11 | Conclui a função atual e retorna ao chamador. |
| Parar | Botão | Encerra o processo de debug. |

Uma linha pode conter várias instruções: o cabeçalho de um `for` pode exigir mais de um passo. Chamadas assíncronas podem terminar a execução de uma função antes de a Promise resolver; observe também a pilha e o `await` do chamador.

**Variáveis do escopo** mostra valores locais, blocos e closures. Na **Pilha de chamadas**, clique em um quadro para inspecionar suas variáveis e suas expressões observadas. Valores que ainda não foram inicializados podem aparecer indisponíveis. Objetos e arrays têm prévias limitadas; observe uma propriedade específica para aprofundar.

As observações recusam expressões com efeitos colaterais, como atribuições e algumas chamadas de função. Getters não são invocados ao listar variáveis. Uma observação inválida aparece com erro sem substituir seu código. Observações têm limite de tempo e tamanho.

Durante a sessão, o código e as chamadas ficam em leitura. A seleção de arquivos do projeto continua disponível. Os breakpoints acompanham inserções e remoções de linhas. Uma formatação que substitui o documento inteiro limpa os breakpoints e informa que é preciso marcá-los novamente; assim não ficam associados a instruções diferentes silenciosamente. Breakpoints e observações ficam guardados por atividade no perfil do navegador do aplicativo.

## Projetos e APIs

Em projetos CommonJS, o Hub inicia `main.cjs`; em projetos HTTP, inicia `app.cjs` e chama `criarServidor`, com os mesmos recursos da aula. Breakpoints podem estar em outros arquivos `.cjs`/`.js`: ao pausar, o editor abre automaticamente o arquivo correspondente. Arquivos de apoio continuam protegidos para edição.

Para investigar uma rota, continue até aparecer **Servidor ativo**. Abra **Requisição para depurar**, escolha o método, informe o caminho e o corpo JSON e envie. A requisição aguarda enquanto você avança pelos breakpoints; após continuar, a resposta aparece no painel. Esse servidor substitui a execução normal enquanto o debug estiver ativo. Bibliotecas e detalhes internos do Node são pulados pelos passos.

O banco persistente e os mocks são os recursos reais da aula. **Executar código em debug pode alterar o banco e chamar APIs, como a execução normal.** O passo a passo acompanha JavaScript; ele não entra nas instruções internas de SQLite ou em código nativo. JSON e SQL não são programas JavaScript depuráveis. Oficinas de npm e Git continuam usando seus comandos normais; o debugger acompanha o arquivo JavaScript, sem executar comandos de instalação.

O programa tem limite de 20 segundos contínuos de execução; tempo em pausa não entra nessa conta. Um servidor pronto pode ficar ocioso. Sessões sem interação são encerradas após dez minutos. Parar ou fechar o aplicativo encerra também o processo inspecionado. Reabrir uma aula encerra sessões antigas sem interface.

**Depurar não valida os testes nem concede progresso.** Para isso, use **Verificar** depois de encerrar a sessão. Atualizar o aplicativo mantém os saves no mesmo perfil, como explicado em [Editor e atualizações](editor-e-atualizacoes.md).

## Roteiro curto para o professor

Use `let total = 0; for (let i = 0; i < 3; i++) { total += i; }` distribuído em linhas. Peça uma previsão do total antes de cada soma. Marque a soma, observe `total` e `i` e execute três repetições. Depois extraia a soma para uma função e compare **Próxima linha**, **Entrar** e **Sair**. Por fim, troque uma entrada e peça ao aluno para encontrar a primeira divergência entre sua previsão e o estado observado.

Referências técnicas: [Inspector do Node](https://nodejs.org/docs/latest-v24.x/api/inspector.html) e [protocolo do debugger do V8](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/).
