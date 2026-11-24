# Documentos JSON

É um armazenamento local de documentos, em memória ou persistido em arquivo JSON. Serve para explorar coleções, filtros e modelos de dados sem tabelas. Não é MongoDB, Redis nem uma implementação completa de um produto NoSQL.

O professor pode fornecer coleções iniciais:

```json
{"tarefas":[{"_id":"t1","titulo":"Estudar SQL","prioridade":2}]}
```

No programa, todas as operações são assíncronas:

```js
const documentos = recursos.documentos("anotacoes");
const tarefa = await documentos.inserir("tarefas", {
  titulo: "Revisar Promises", prioridade: 3,
});
console.log(tarefa._id); // gerado se não for informado

const urgentes = await documentos.buscar("tarefas", {
  prioridade: { $gte: 2 },
});
await documentos.atualizar("tarefas", { _id: tarefa._id }, {
  prioridade: 1,
});
await documentos.remover("tarefas", { _id: tarefa._id });
```

Atualizar e remover afetam todos os documentos que correspondem ao filtro. Atualizar faz uma alteração superficial das propriedades informadas e preserva `_id`; não substitui o documento inteiro. Inserir em uma coleção nova a cria. Um `_id` repetido é recusado.

O filtro aceita igualdade profunda e os operadores `$gt`, `$gte`, `$lt`, `$lte`, `$ne` e `$in`. Não aceita funções, expressões JavaScript, operadores arbitrários, agregações ou caminhos aninhados. Buscar retorna até mil documentos. Não há joins, índices configuráveis, transações entre coleções ou garantia de equivalência com drivers externos.

Na aba Documentos, peça uma previsão antes de usar Inserir, Atualizar e Remover. Para ensinar a criação da estrutura, escolha preparo vazio. Depois exija que o código crie seus próprios documentos: dados inseridos manualmente não entram nos testes isolados.

Fora do Hub, primeiro reproduza uma coleção com JSON e `node:fs`. Depois compare conscientemente esse modelo com um banco de documentos real, estudando seus índices, consistência, consultas e transações na documentação do fornecedor. Não transfira automaticamente as regras deste adaptador para outro banco.
