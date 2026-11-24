# SQLite: de consultas a modelagem

O banco é SQLite real, fornecido por `node:sqlite`. O painel SQL e o programa do aluno acessam a mesma conexão do recurso, inclusive quando o banco está inteiramente em memória.

## Preparado pelo professor

Configure um recurso `banco`, com preparo automático:

```sql
-- Estrutura inicial
CREATE TABLE tarefas (
  id INTEGER PRIMARY KEY,
  titulo TEXT NOT NULL,
  concluida INTEGER NOT NULL DEFAULT 0
);
-- Dados iniciais, em campo separado
INSERT INTO tarefas VALUES (1, 'Revisar funções', 0);
```

O preparo inicial executa em transação. Em arquivo, ele só acontece na primeira preparação: reabrir não duplica o INSERT nem apaga atualizações. Alterar o texto do seed não migra um banco já existente. Use Restaurar dados iniciais para reaplicar a estrutura, ou escreva uma migração explícita como parte da atividade.

## No código

```js
const banco = recursos.sqlite("banco");
const tarefas = await banco.consultar(
  "SELECT id, titulo FROM tarefas WHERE concluida = ? ORDER BY id",
  [0],
);
console.log(tarefas);

const resultado = await banco.executar(
  "UPDATE tarefas SET concluida = ? WHERE id = ?",
  [1, 1],
);
console.log(resultado.changes);
```

`consultar` devolve um array de linhas. `executar` devolve linhas ou metadados como `changes` e `lastInsertRowid`. Parâmetros são um array JSON de valores; nomes de tabelas e colunas não podem ser substituídos por `?`.

## Banco construído pelo aluno

Escolha preparo **Começar vazio** e permita DDL. Os campos de estrutura e seed não executam nesse modo. O aluno pode criar a tabela na aba SQL, executar um script ou usar:

```js
await recursos.sqlite("banco").script(`
  BEGIN;
  CREATE TABLE tarefas(id INTEGER PRIMARY KEY, titulo TEXT NOT NULL);
  INSERT INTO tarefas VALUES(1, 'Meu primeiro registro');
  COMMIT;
`);
```

Se um script com transação falhar, investigue a mensagem e use `ROLLBACK` quando houver uma transação pendente. Não use a execução de vários comandos sem transação como sinônimo de atomicidade.

Para avaliar DDL feito no painel, transforme o SQL produzido em código entregável: um arquivo SQL no projeto ou uma chamada a `script` na função. As verificações usam bancos novos e não leem o histórico manual do painel.

## Permissões e continuidade

DDL e DML têm permissões independentes. O banco inicial pode conter tabelas mesmo com DDL desabilitado para o aluno. `ATTACH`, `DETACH`, PRAGMAs e carregamento de extensões são bloqueados pelo adaptador da bancada. Não há suporte a PostgreSQL/MySQL nem equivalência total entre seus dialetos e SQLite.

Fora do Hub, leia a [API SQLite do Node](https://nodejs.org/download/release/v24.13.0/docs/api/sqlite.html), substitua o adaptador por uma conexão `DatabaseSync` recebida por parâmetro e escreva testes com banco temporário. Explique quais partes do código são SQL e quais pertencem ao driver.
