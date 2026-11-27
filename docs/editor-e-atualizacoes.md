# Editor e atualizações

O editor usa CodeMirror para edição e Shiki/TextMate para as cores. O tema é o arquivo original da extensão Dracula Pro 1.1.0 fornecida pelo professor, em editor/temas/dracula-pro.json; os escopos de JavaScript, JSON e SQL são interpretados pelo TextMate. O destaque de fallback do CodeMirror foi desabilitado para não sobrescrever as cores. Exemplos e gabaritos usam o mesmo destaque JavaScript. A licença MIT do tema acompanha as bibliotecas do editor.

Fira Code é incluída em WOFF2 no aplicativo e funciona offline, sem instalar fontes no sistema. Ligaturas ficam ativas por padrão e não alteram o texto copiado ou executado. Em **Conforto**, ajuste tamanho do código e da leitura, ligaturas, quebra de linha, contraste, espaço dos resultados e navegação compacta. As preferências ficam no perfil do aplicativo; não dependem da porta local usada pela janela.

Na prática, o editor permanece visível com console ou verificação embaixo. Arraste o divisor entre enunciado e código ou use suas setas pelo teclado. Em telas pequenas e zoom elevado, os painéis passam para uma disposição vertical sem cobrir o editor. Ao trocar de atividade, o histórico de desfazer permanece disponível na sessão; cursor e posição de leitura são guardados para retomada.

**Minhas tentativas** conserva verificações recentes e as últimas tentativas aprovadas, além de uma cópia antes de restaurar o código inicial. Compare e recupere uma tentativa sem modificar os critérios da aula. Um código aprovado anteriormente só continua aprovado quando sua assinatura ainda corresponde aos critérios atuais.

O placar conta os testes da questão atual; o progresso da aula conta questões aprovadas. Em projetos, observações registradas e aprovação automática do projeto são indicadores distintos. A primeira falha abre automaticamente e chamadas com entradas reproduzíveis podem ser levadas ao rascunho ou debugger.

## Horas de estudo

O relógio do Aluno separa leitura e prática por dia, aula e atividade. O botão no topo mostra o tempo acumulado da atividade/aula atual e de hoje; abre o detalhamento e a exportação CSV. Há pausa manual e pausa automática em segundo plano, fora de uma aula, em diálogos ou após um período sem interação. O padrão é cinco minutos; pode ser alterado em Conforto.

É uma estimativa de atividade na janela, não uma medida de atenção ou uma condição para aprovação. O relógio usa tempo monotônico, evitando contar suspensão ou mudanças do relógio do sistema. Os registros são gravados periodicamente em `.dados/tempo.sqlite` no perfil local; identificadores únicos evitam duplicação ao reenviar um lote. A contagem não envia códigos, teclas ou movimentos do aluno ao professor. Os dados continuam no perfil ao atualizar o aplicativo.

Use **Formatar** ou **Shift+Alt+F** em JavaScript/JSON. Prettier aplica indentação de dois espaços e organiza o código. A formatação é uma única operação de desfazer: **Ctrl+Z** recupera a versão anterior. Se houver erro de sintaxe, o texto não é substituído; a mensagem indica a posição para revisar. Arquivos de apoio e demonstrações permanecem somente para leitura. SQL tem destaque, mas não usa esse formatador.

A formatação funciona offline, com bibliotecas incluídas no aplicativo. Ela só ocorre quando solicitada; o aluno pode manter código incompleto para investigar seu raciocínio.

## O save é mantido em updates?

Sim, no mesmo computador e usuário do Windows. As edições portátil e instalada usam o perfil em `%APPDATA%\BeninDJ Hub Aluno` (Professor tem outro perfil). Códigos, aulas importadas, progresso e bancos persistentes ficam nesse perfil, fora do executável e da instalação.

Atualizar o programa não distribui aulas futuras nem apaga respostas. Se uma nova aula alterar os critérios, pode ser necessário verificar novamente uma resposta; isso não apaga o código. Recursos em memória recomeçam quando encerrados, como já acontecia antes.

Para uma cópia completa, feche o aplicativo e copie a pasta do perfil. Exportar respostas pelo menu Arquivo é útil para guardar código, mas não substitui uma cópia de todos os bancos e arquivos do perfil. Trocar somente o executável não transporta dados para outro computador.

## Verificação automática

A release Aluno 0.10 executa a versão oficial 0.9 em um perfil temporário, salva código com acentos, aprovação, uma aula importada e uma alteração SQLite; depois abre a versão nova no mesmo perfil e confere esses dados. O teste não usa nem altera o AppData real do aluno.
