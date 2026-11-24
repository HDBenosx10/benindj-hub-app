# BeninDJ Hub 0.11.1

- Painel Debug recolhível à direita do editor, com controles sempre acessíveis durante a inspeção.
- Breakpoints na margem ou por número de linha, confirmação da instrução executável e destaque da próxima linha.
- Continuar/pausar (F8), próxima linha (F10), entrar (F11), sair (Shift+F11) e parar, usando o inspector real do Node em outro processo.
- Expressões observadas, variáveis locais, blocos, closures e seleção de quadros da pilha. Observações recusam efeitos colaterais e têm limite de tempo.
- Projetos CommonJS e APIs: breakpoints entre arquivos, abertura automática do arquivo pausado e cliente HTTP para investigar rotas com os recursos reais da aula.
- Testes do executável verificam breakpoints, avanço, valores, preservação das respostas e fechamento durante uma pausa. O encerramento aguarda as conexões sem forçar a saída do runtime no Windows.

Leia o [guia de depuração](https://github.com/HDBenosx10/benindj-hub-app/blob/main/docs/depuracao.md) para uso e limites. Debug acompanha JavaScript; JSON, SQL nativo e comandos npm/Git usam seus fluxos próprios. Depurar pode alterar os recursos, como a execução normal, e não concede aprovação nos desafios.

## Editor e correção de cores incluídos

- Corrige o mapeamento Dracula Pro: const, let, var e function em rosa, sem itálico; comentários sem itálico e parâmetros em laranja itálico.
- Editor, exemplos e gabaritos usam as mesmas regras corrigidas. A referência consultada foi a extensão VS Code do repositório Dracula Pro do usuário.


- Novo editor CodeMirror, com parser JavaScript e paleta consultada no Dracula Pro.
- Destaque coerente de funções, strings, regex, comentários e interpolações; linguagens próprias para arquivos JSON e SQL.
- Botão Formatar e atalho Shift+Alt+F para JavaScript/JSON, usando Prettier offline e indentação de dois espaços.
- Ctrl+Z desfaz a formatação. Código com sintaxe incompleta é preservado, com indicação do ponto a revisar.
- Exemplos e gabaritos seguem o mesmo destaque. Arquivos de apoio continuam somente para leitura.
- Teste automático de atualização da versão 0.9, conferindo códigos, aulas, progresso e SQLite persistente.

## Atualização e dados

No mesmo computador e usuário do Windows, portátil e instalador preservam os dados em `%APPDATA%\BeninDJ Hub Aluno` (ou Professor), fora do executável. Não apague essa pasta ao atualizar. Recursos em memória são temporários. O aplicativo Aluno continua incluindo apenas Hello World; aulas futuras dependem de liberação do professor.

Use o arquivo com Instalador para instalar/atualizar pelos atalhos. O outro .exe é portátil.
