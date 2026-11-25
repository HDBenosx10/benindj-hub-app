# Acervo por turma e atualizações

## Corrigir aulas já entregues · 0.14

Depois da primeira atualização de Professor e Aluno para 0.14.0, correções de conteúdo não exigem trocar arquivos ou reinstalar o Hub.

No Professor, abra a aula e clique em **Editar esta aula**. Faça a alteração no estúdio, vá à etapa **Revisão** e escolha **Salvar e enviar atualização**. O aplicativo valida os gabaritos, salva a revisão e mostra as turmas que já receberam aquela aula. Marque os destinos e confirme em **Enviar atualização às turmas**. Para publicar uma alteração já salva, use **Enviar atualização** no cabeçalho da aula. **Salvar no acervo** continua sendo uma gravação privada, sem distribuição.

O Aluno com convite ativado consulta correções das aulas já recebidas na abertura, ao voltar para a janela, ao recuperar a conexão e a cada dois minutos enquanto a janela está visível. Uma aula fechada é atualizada automaticamente. Se a aula estiver aberta, o aplicativo mostra **Salvar e aplicar atualização**; ele preserva o código e retoma a atividade. Execução, debugger, servidor ativo e diálogos precisam terminar antes da aplicação.

O código antigo permanece salvo mesmo se a assinatura da função mudar: o aluno deve adaptá-lo ao novo enunciado. Somente os exercícios cujos critérios mudaram exigem verificar novamente. A revisão anterior do conteúdo fica no histórico local; isso não é um histórico automático de todas as edições do código do aluno.

As primeiras liberações de novas aulas e os planejamentos continuam chegando por **Receber aulas disponíveis** e confirmação. A consulta automática altera somente aulas que o aluno já importou. Quem recebeu conteúdo por arquivo precisa ativar um convite da turma para receber as próximas correções online. O serviço só entrega as revisões explicitamente publicadas para essa turma.

## Objetivos, planejamento e conteúdo

Na versão 0.13, **meus objetivos** são a preferência do aluno por uma área e linguagem. Eles ajudam a encontrar percursos compatíveis; não criam estágios nem liberam conteúdo.

O professor cria o planejamento em **Trilhas do professor → Criar trilha**: dá um nome, define objetivo, escolhe aulas, escreve grupos e ajusta a ordem. O planejamento inclui apenas ids, números, títulos, grupos e sequência. Não inclui enunciados, exemplos, código, testes ou gabaritos.

Use **Exportar planejamento** para gerar um `.trilha-hub`, ou **Publicar planejamento para turma** para disponibilizá-lo online. O Aluno recebe esse arquivo pelo botão de importação ou pela sincronização em Conexões e atualizações. Em **Trilhas recebidas**, já vê as etapas futuras com o aviso **Aguardando liberação do professor**.

O conteúdo é uma segunda liberação: publique as aulas selecionadas para a turma ou envie `.aula-hub`/`.aulas-hub`. Só as aulas efetivamente recebidas passam a abrir. Importar uma trilha nunca cria uma aula executável nem concede aprovação. A API também exige a liberação de conteúdo para baixar uma aula cujo título já aparece no planejamento.

Editar o planejamento não altera as aulas nem os gabaritos. Exporte ou publique novamente apenas o planejamento para atualizar grupos e sequência. Na API, cada turma conserva a revisão explicitamente publicada para ela.

## Início e ponto de retomada

Sem atividade anterior, o Início indica a primeira aula disponível, em vez das últimas importadas. Com um percurso selecionado, usa a ordem definida pelo professor. O painel distingue não iniciadas, em andamento, concluídas e etapas aguardando conteúdo.

Ao abrir uma aula, trocar aba, atividade ou arquivo, o Hub guarda a posição no perfil local. **Retomar minha atividade** restaura a aula, a aba e a atividade. Aprovações continuam dependendo dos testes: abrir ou importar material não valida exercícios.

Receber uma trilha nova não troca uma atividade que já estava em andamento; o aluno pode escolher outro percurso explicitamente. Ao concluir tudo que foi liberado, o painel mostra as próximas etapas aguardando o professor, sem dizer que a trilha inteira acabou.

Códigos e aprovações antigos são preservados. Datas históricas de navegação não são inventadas: o registro de posição começa ao usar a nova versão. Aulas antigas sem planejamento continuam disponíveis como aulas avulsas.

## Professor e Aluno no mesmo computador

As duas edições podem ser instaladas e executadas simultaneamente. A partir da 0.12.1, usam as pastas de programas `benindj-hub-professor` e `benindj-hub-aluno`, além de caches de atualização separados. Os identificadores do Windows e as travas de instância distinguem as edições.

Os dados continuam em `%APPDATA%\BeninDJ Hub Professor` e `%APPDATA%\BeninDJ Hub Aluno`. Instalar uma edição não transforma nem sobrescreve o perfil da outra. Para conferir a experiência real do Aluno, abra o aplicativo Aluno e ative um convite próprio de teste.

As versões anteriores tinham um conflito de pasta nos instaladores. Use os dois instaladores 0.12.1 para corrigir instalações afetadas, sem desinstalar nem remover seus dados. A migração preserva a antiga pasta compartilhada para não apagar arquivos da outra edição. Somente o Aluno registra as extensões de aulas para abertura por duplo clique.

## Para o professor

Abra **Conexões e atualizações**, no rodapé do menu lateral. Neste computador a edição Professor já foi conectada ao serviço. A conexão fica no perfil do Windows, fora do executável; ela não é incluída no instalador enviado a outras pessoas.

1. Crie uma turma e selecione-a.
2. Abra **Publicar aulas para esta turma**, marque somente as aulas que deseja disponibilizar e clique em **Publicar aulas selecionadas**. Nenhuma aula é selecionada ou liberada automaticamente. Gabaritos não são enviados.
3. Em **Alunos e convites**, informe o nome do aluno e gere seu convite individual. Copie o código mostrado e envie-o ao aluno. O código completo só aparece nesse momento: o serviço guarda seu hash.
4. Para trocar o computador de um aluno, escolha **Trocar computador / novo convite**. Isso revoga a instalação anterior. Para interromper o acesso a novas sincronizações, use **Revogar acesso**.

Uma publicação cria uma revisão imutável. Alterar uma aula no estúdio não modifica a aula online até publicá-la novamente. Cada turma conserva a revisão explicitamente liberada. **Retirar da turma** interrompe downloads futuros daquela aula; não apaga cópias já recebidas.

O convite vence em 48 horas e só pode ser resgatado uma vez. Quem o resgatar primeiro ativa uma instalação; não existe verificação de identidade por e-mail. Envie por um canal individual e confira o nome da matrícula antes de reemitir.

## Para o aluno

Instale o Hub, abra **Conexões e atualizações**, cole o convite completo e clique em **Ativar meu acesso**. O endereço do serviço já está dentro do convite.

**Conferir novas aulas** consulta o catálogo da sua turma. **Receber aulas disponíveis** baixa as revisões novas e abre a revisão em lote: aulas novas já vêm marcadas; a substituição de uma aula existente exige escolha explícita. Respostas e bancos em arquivo são preservados. Quando os critérios de avaliação mudam, será necessário verificar os desafios novamente.

Depois de recebidas, as aulas funcionam offline. Desconectar não apaga o estudo local. Recursos definidos como bancos em memória continuam temporários, conforme a configuração da aula.

O instalador do Aluno continua incluindo exclusivamente a aula 0. O acervo do Professor e aulas futuras não ficam escondidos dentro desse instalador: só chegam ao aluno por importação ou por liberação da turma.

## Atualizar o aplicativo

Na edição instalada, o Hub verifica a versão estável alguns segundos depois de abrir. Também é possível clicar em **Verificar atualizações**. Não há download nem instalação automática durante a atividade.

Depois de **Baixar atualização**, o botão **Salvar e reiniciar para atualizar** salva o trabalho e inicia a instalação. Aulas, respostas, progresso, bancos em arquivo e conexão ficam em `%APPDATA%\BeninDJ Hub Aluno` ou `%APPDATA%\BeninDJ Hub Professor`, separados dos executáveis.

A portable oferece **Baixar nova portable**: escolha onde salvar e substitua a versão anterior depois de fechar. Não há substituição automática do executável em uso.

Versões anteriores à 0.12 não têm esse updater. Será necessário instalar uma vez a primeira versão com a funcionalidade. Não desinstale nem remova o perfil de dados para atualizar.

Os downloads exigem um manifesto Ed25519 assinado pela chave fixada no aplicativo, além dos checksums do instalador. A CI bloqueia a publicação se o manifesto, o YAML e o executável não corresponderem. Apenas releases estáveis publicadas entram no updater; rascunhos e pré-releases ficam fora.

A atualização do Professor passa pela API autenticada porque seu repositório é privado. Credenciais do GitHub não são distribuídas nos aplicativos. Se o token de leitura expirar, o Professor continua funcionando; renove o token com o configurador local do serviço.

## Limite da proteção do conteúdo

O resgate é atômico: duas tentativas simultâneas não conseguem ativar o mesmo convite. As requisições do aluno exigem prova com a chave privada da instalação e um desafio de uso único, evitando usar apenas um identificador copiado. A chave fica protegida pelo Windows.

Isso controla a distribuição e o acesso às próximas aulas. Não impede que alguém copie código ou conteúdo que já recebeu para estudar offline. Os pacotes levam um recibo assinado associado à matrícula para ajudar a identificar a origem de um compartilhamento; esse recibo não é DRM. O professor pode conferi-lo pela operação administrativa `verificar-marca`.

## Publicar uma versão

Depois da validação local, use o workflow **Gerar versão Windows**, escolha uma versão inédita e mantenha **Publicar imediatamente** desmarcado para revisar o rascunho. A CI gera instalador, portable, checksums, blockmap, YAML e manifesto assinado. Publicar uma release estável a disponibiliza para os respectivos aplicativos.

O segredo `HUB_UPDATE_PRIVATE_KEY` deve existir nos dois repositórios. Guarde um backup seguro da chave original em `.local/update-signing-key.pem`; ela é ignorada pelo Git. Não crie uma chave nova para cada versão: os aplicativos instalados confiam na chave pública original. A chave privada nunca deve entrar em commit, executável ou conversa.

Os testes desktop executados com `HUB_QA_REPORT` mantêm a janela oculta e usam um perfil temporário. Nenhum teste local exige abrir uma janela sobre a aula.
