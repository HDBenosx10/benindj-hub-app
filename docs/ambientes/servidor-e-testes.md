# Servidor e critérios de verificação

Em uma aula de projeto HTTP, `app.cjs` exporta uma fábrica. Ela recebe as dependências e devolve um `http.Server` sem chamar `listen`:

```js
const http = require("node:http");
exports.criarServidor = ({ recursos }) => http.createServer(async (req, res) => {
  try {
    const tarefas = await recursos.sqlite("banco").consultar(
      "SELECT id, titulo FROM tarefas ORDER BY id",
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tarefas));
  } catch (erro) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ erro: erro.message }));
  }
});
```

Isso é injeção de dependências explícita: a função não procura um banco global. O Hub escolhe uma porta livre e inicia o servidor em loopback. O aluno pode criar handlers, módulos de regras e repositórios nos arquivos declarados pelo professor, que marca quais são editáveis. O modelo inicial usa apenas Node; não exige Express.

No projeto, Executar projeto carrega os arquivos atuais; depois de editar, execute novamente. O explorador HTTP envia requisições reais. O painel Ambiente consulta os mesmos recursos entregues a `criarServidor`.

## Cenários públicos

```json
{
  "nome":"Cadastro e consulta",
  "acoes":[
    {"metodo":"POST","caminho":"/tarefas","corpo":{"titulo":"Estudar"},"status":201},
    {"metodo":"GET","caminho":"/tarefas","status":200,"json":[{"titulo":"Estudar"}]},
    {"recurso":"banco","acao":"sql","sql":"SELECT COUNT(*) AS total FROM tarefas","esperado":{"linhas":[{"total":1}]}}
  ]
}
```

Cada cenário começa com uma pasta e recursos novos. As ações de um mesmo cenário compartilham estado; cenários diferentes não compartilham. Objetos esperados conferem as propriedades declaradas; arrays conferem quantidade e ordem. Especifique `ORDER BY` se a ordem fizer parte do contrato.

Em funções, `recursos` também está disponível no código e no corpo do teste. Cada caso ganha um ambiente novo. Um teste pode preparar condições explicitamente com `await recursos.sqlite(...).script(...)`, executar a função e retornar o valor esperado. Não inclua a solução no código inicial ou nos exemplos.

A conferência do professor executa os gabaritos de funções e projetos HTTP. Só salve a aula após verificar a solução e uma tentativa incorreta. Testes aprovados verificam os contratos descritos, não substituem revisão de código e explicação do raciocínio.

## Executar o cliente

Quando a aula oferece `cliente.cjs`, a bancada permite escolher `consultarProdutos` ou `criarProduto` em **Função do cliente** e usar **Executar cliente.cjs**. A criação recebe o objeto do campo **Corpo JSON**; a base local e a sessão atual são fornecidas. O botão **Enviar requisição** continua sendo o explorador direto da API, útil para confirmar o efeito de uma chamada feita pelo código do aluno.

## Cenários com duas sessões

Uma ação de login com `"token": "primeira"` guarda uma sessão nomeada. Use `"autorizado": "primeira"` nas ações que devem reutilizá-la. Isso permite testar revogação, isolamento e escopo por usuário sem usar sempre a última sessão. `true` conserva o comportamento anterior de sessão atual. Recursos com estes novos critérios exigem o próximo runtime, 0.15.0; não distribua essas aulas a um aplicativo antigo.

As verificações de logs conferem método, pathname, status final e duração numérica contra as respostas observadas, além de recusar campos e dados sensíveis. A verificação de senhas confere também uma derivação scrypt independente nos parâmetros didáticos do laboratório; formato do hash sozinho não prova algoritmo ou verificação correta. Isso não certifica segurança de produção nem constância temporal de toda a aplicação.
