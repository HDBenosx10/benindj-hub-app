# Bancada de back-end

Requer BeninDJ Hub 0.7 ou superior. Atualize os executáveis do professor e do aluno antes de distribuir aulas com recursos.

O Hub usa Node.js real para executar funções e servidores HTTP. Uma aula pode declarar até oito recursos locais: SQLite, documentos JSON e APIs simuladas. O aluno recebe o manifesto no arquivo `.aula-hub`; os recursos são preparados ao importar e abrir a aula. O código do aluno só executa quando ele escolhe Executar.

## Escolha pedagógica

| Objetivo | Preparação |
|---|---|
| Ensinar consultas | SQLite automático, DDL/seed fornecidos e DDL desabilitado nas permissões |
| Ensinar alteração de registros | Permitir DML; conferir o efeito com SELECT |
| Ensinar modelagem | SQLite no modo aluno: começa vazio, com DDL permitido |
| Ensinar integração e assincronismo | Mock HTTP com contratos, atraso e sequência de respostas |
| Ensinar documentos | Coleções JSON prontas ou vazias, em memória ou arquivo |
| Dar autonomia | Permitir criar recursos adicionais; complementar com Fora do Hub |

DDL define estrutura (`CREATE`, `ALTER`, `DROP`). DML altera dados (`INSERT`, `UPDATE`, `DELETE`). Não confunda criar uma tabela com inserir um registro nela.

O professor configura isso em **Criar aula → Ambiente e materiais**. **Novo projeto back-end** fornece um modelo técnico de servidor, banco e integração para adaptar. Não adiciona uma aula automaticamente ao acervo do aluno.

## Leituras focadas

- [SQL: tabelas, dados e persistência](sql.md)
- [Documentos JSON e limites do NoSQL local](documentos.md)
- [Mocks, falhas e assincronismo](mocks.md)
- [Contrato do servidor e dos testes](servidor-e-testes.md)
- [Manifesto da aula](manifesto.md)
- [Projeto fora do Hub](fora-do-hub.md)

## Ciclo de vida

Executar usa o ambiente de exploração. Verificar cria outro ambiente para cada caso, com o manifesto do professor, sem aproveitar alterações experimentais. A demonstração do professor também usa um ambiente separado. Assim, um UPDATE feito pelo aluno na bancada não adultera os testes.

Ao adicionar um recurso, os recursos existentes continuam ativos. Editar a configuração de um recurso reinicia o ambiente: os dados em memória recomeçam; os arquivos persistentes permanecem. Reiniciar também zera contadores dos mocks. Trocar de aula encerra o ambiente anterior e libera as portas; bancos em memória se perdem.

Restaurar dados iniciais guarda os arquivos anteriores em um backup local e cria novamente o ambiente inicial. Não apaga o código do aluno. Os dados ficam no perfil do aplicativo, separados por aula e por visão de aluno/professor.

## Limites concretos

Os serviços da bancada escutam somente em `127.0.0.1` e escolhem portas livres. Não precisam de Docker, contas de nuvem ou instalação de servidores. SQL e documentos são acessados assincronamente por um adaptador fornecido como parâmetro.

Os recursos executam em outro processo, com limite de heap de 128 MB. Funções, verificações e servidores do aluno também usam processos descartáveis, com encerramento supervisionado. Operações do painel têm prazo de aproximadamente 4,5 segundos; consultas SQL nativas podem ser interrompidas encerrando esse processo. SQL retorna até mil linhas, cada banco tem limite de 4096 páginas, documentos têm limite de 2 MB por recurso e o histórico dos mocks mantém as últimas 200 chamadas. O ambiente oferece limites didáticos e isolamento de estado, não uma sandbox de segurança do sistema operacional: o código Node ainda deve ser de origem confiável.
