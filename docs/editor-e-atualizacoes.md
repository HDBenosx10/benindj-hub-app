# Editor e atualizações

O editor do laboratório usa CodeMirror com parser JavaScript. A paleta foi consultada no Dracula Pro do usuário. Strings, comentários, números, expressões regulares e interpolações têm categorias de sintaxe próprias. Arquivos JSON e SQL recebem a linguagem correspondente. Exemplos e gabaritos usam o mesmo destaque JavaScript.

Use **Formatar** ou **Shift+Alt+F** em JavaScript/JSON. Prettier aplica indentação de dois espaços e organiza o código. A formatação é uma única operação de desfazer: **Ctrl+Z** recupera a versão anterior. Se houver erro de sintaxe, o texto não é substituído; a mensagem indica a posição para revisar. Arquivos de apoio e demonstrações permanecem somente para leitura. SQL tem destaque, mas não usa esse formatador.

A formatação funciona offline, com bibliotecas incluídas no aplicativo. Ela só ocorre quando solicitada; o aluno pode manter código incompleto para investigar seu raciocínio.

## O save é mantido em updates?

Sim, no mesmo computador e usuário do Windows. As edições portátil e instalada usam o perfil em `%APPDATA%\BeninDJ Hub Aluno` (Professor tem outro perfil). Códigos, aulas importadas, progresso e bancos persistentes ficam nesse perfil, fora do executável e da instalação.

Atualizar o programa não distribui aulas futuras nem apaga respostas. Se uma nova aula alterar os critérios, pode ser necessário verificar novamente uma resposta; isso não apaga o código. Recursos em memória recomeçam quando encerrados, como já acontecia antes.

Para uma cópia completa, feche o aplicativo e copie a pasta do perfil. Exportar respostas pelo menu Arquivo é útil para guardar código, mas não substitui uma cópia de todos os bancos e arquivos do perfil. Trocar somente o executável não transporta dados para outro computador.

## Verificação automática

A release Aluno 0.10 executa a versão oficial 0.9 em um perfil temporário, salva código com acentos, aprovação, uma aula importada e uma alteração SQLite; depois abre a versão nova no mesmo perfil e confere esses dados. O teste não usa nem altera o AppData real do aluno.
