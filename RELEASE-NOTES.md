# BeninDJ Hub 0.14.2 — revisão integral do acervo

- Revisadas as 46 aulas: 275 exercícios de função e 135 missões, com cobertura individual das 410 atividades.
- Reestruturados 61 exercícios para substituir tarefas redundantes, tornar efeitos observáveis e respeitar os pré-requisitos.
- Contextos próprios, parâmetros e retornos explícitos; atividades de diagnóstico passam a trazer código realmente defeituoso.
- Missões de projeto identificam preparação, arquivos acessíveis e evidência. Observações manuais são distinguidas dos cenários automatizados do projeto.
- Acervo passa de 948 para 1.051 casos automatizados, incluindo fronteiras, preservação de estado, callbacks, Promise e concorrência.
- Auditoria local experimentou 2.522 variantes simplificadas/incorretas. Nenhum dos atalhos triviais testados aprova; mutações equivalentes foram analisadas e documentadas separadamente.
- Referências específicas e pontes conceituais adicionadas; comandos Git necessários às atividades passam a estar disponíveis na oficina.
- Busca SQLite por trecho trata percentual como dado literal; cenários HTTP/SQL foram confrontados com o projeto real.
- DEV Coruja recebe os mesmos critérios para propostas futuras, sem pressupor conceitos ainda não apresentados.

Esta atualização entrega o **acervo revisado ao Professor**. Atualize também o Aluno para 0.14.2: essa versão preserva as aprovações existentes quando apenas redação ou metadados mudam. Critérios executáveis ou ambientes alterados ainda exigem nova verificação. Depois de revisar as alterações, o professor publica as novas revisões para suas turmas pelo acervo conectado. Salvar o acervo local não publica automaticamente.

Códigos do aluno são preservados. Algumas atividades mudaram de proposta ou assinatura para corrigir a progressão; as tentativas antigas continuam salvas e devem ser adaptadas. A aprovação de atividades alteradas precisa de nova verificação.

Relatório individual no repositório privado: curadoria/REVISAO-INTEGRAL.md. A geração atual é idempotente, a partir de curadoria/revamp/gerar.mjs e dos mapas em curadoria/qualidade/.

A edição Aluno 0.14.2 inclui a migração de aprovações durante atualizações de conteúdo. A publicação do acervo revisado exige essa versão mínima, impedindo que uma instalação antiga perca aprovações por causa de uma alteração apenas editorial. Se a migração não puder ser gravada, a importação preserva o conteúdo anterior e permite nova tentativa. O acervo pago e os gabaritos continuam exclusivos do Professor.
