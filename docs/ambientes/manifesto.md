# Manifesto de recursos

O schema de aula continua sendo 3. Os novos campos são opcionais para manter aulas antigas compatíveis:

```json
{
  "ambiente": {
    "versao": 1,
    "permitirCriacao": true,
    "recursos": [{
      "id": "banco",
      "nome": "Tarefas da aula",
      "tipo": "sqlite",
      "modo": "memoria",
      "preparo": "automatico",
      "editavel": false,
      "permissoes": {"ddl": false, "dml": true},
      "ddl": "CREATE TABLE tarefas(id INTEGER PRIMARY KEY, titulo TEXT);",
      "seed": "INSERT INTO tarefas VALUES (1, 'Exemplo');"
    }]
  },
  "materiaisComplementares": {
    "guia": "Conceitos, pré-requisitos, perguntas e roteiro de investigação.",
    "foraDoHub": "Comandos e passos para reproduzir e reconstruir o projeto.",
    "desafiosTransferencia": "Novos contextos e critérios para avaliar autonomia.",
    "referencias": [{"titulo":"SQLite no Node","url":"https://nodejs.org/api/sqlite.html"}]
  }
}
```

Identificadores usam letras minúsculas, números e hífen, começando por letra. São únicos na aula. `editavel` controla a configuração do recurso, não o conteúdo do banco: as operações SQL são controladas por `permissoes`. O aluno pode consultar um recurso fixo e atualizar dados se DML estiver habilitado.

`permitirCriacao` autoriza recursos novos. O aluno não pode remover ou redefinir recursos fixos do professor por uma configuração personalizada. A configuração extra pertence somente àquela aula e visão; não muda o catálogo original.

No estúdio, os formulários produzem esse manifesto. A DEV Coruja recebe instruções sobre os adaptadores e os campos complementares. A proposta continua sendo rascunho: é preciso revisar contexto, recursos, testes e materiais antes de salvar e exportar.
