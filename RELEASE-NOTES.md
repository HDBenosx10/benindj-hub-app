# BeninDJ Hub 0.10.1

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
