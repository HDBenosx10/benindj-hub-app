# APIs simuladas e assincronismo

Cada mock é um servidor HTTP local real. A aula configura método, caminho, status, corpo JSON, headers, atraso e uma sequência opcional de respostas. Os caminhos são comparados exatamente; query strings não alteram a escolha da rota. Não há parâmetros dinâmicos no caminho nem código de resposta arbitrário.

```json
{
  "id":"externa",
  "tipo":"mock-http",
  "editavel":true,
  "rotas":[{
    "metodo":"GET",
    "caminho":"/disponibilidade",
    "sequencia":[
      {"status":503,"corpo":{"erro":"Indisponível"}},
      {"status":200,"atrasoMs":150,"corpo":{"disponivel":true}}
    ]
  }]
}
```

Use `recursos.url("externa") + "/disponibilidade"` como URL de `fetch`. O adaptador escolhe a porta; não grave uma porta observada na aula dentro do código. A sequência mantém a última resposta depois de consumida e recomeça ao reiniciar o ambiente.

## Erro HTTP é diferente de falha de transporte

```js
const resposta = await fetch(recursos.url("externa") + "/disponibilidade", {
  signal: AbortSignal.timeout(500),
});
if (!resposta.ok) {
  throw new Error(`Serviço respondeu HTTP ${resposta.status}`);
}
const dado = await resposta.json();
```

Um status 503 normalmente resolve a Promise de fetch com uma resposta; cabe ao código conferir `ok`/`status`. Um timeout rejeita a Promise. Faça o aluno tratar e explicar os dois caminhos, preservando a causa do erro quando fizer sentido.

## Progressão possível

1. Uma chamada com `await`: verificar caminho, status e corpo.
2. Erro HTTP: conferir que o código não usa um corpo de falha como sucesso.
3. Atraso maior que o timeout: observar cancelamento e decidir o que mostrar ao cliente.
4. Duas chamadas independentes: comparar sequência com `Promise.all`.
5. Falha parcial: estudar `Promise.allSettled` e manter os resultados válidos.
6. Repetição: limitar tentativas e discutir idempotência antes de repetir uma operação que altera estado.

O histórico da aba APIs simuladas mantém até 200 chamadas e corpos resumidos. Ele ajuda a explicar quantas tentativas foram feitas. Não use tempos exatos de milissegundos como gabarito: máquinas e escalonamento variam. Teste resultados e contratos.

Um mock não reproduz automaticamente autenticação, limites de uso, webhooks, comportamento de rede ou mudanças de contrato de um provedor externo. Como transferência, escreva testes de contrato e só depois experimente uma API real com credenciais próprias e dados de teste.
