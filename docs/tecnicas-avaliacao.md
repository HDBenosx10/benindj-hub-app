# Avaliação de comportamento e técnica

O laboratório mantém testes de comportamento no executor isolado. Quando uma questão tem uma técnica como objetivo explícito, o professor pode acrescentar um caso de estrutura. Não é necessário instalar Jest no computador do aluno. O analisador Acorn acompanha o aplicativo; comentários, strings e formatação não são tratados como código executável.

No Studio, abra uma questão e use **Exigir uma técnica**. Informe a função e escolha a regra. Mantenha também casos que confiram resultados, limites, efeitos, erros ou ordem de execução. O requisito aparece automaticamente no enunciado do aluno, em **Técnica exigida nesta questão**, e tem seu próprio resultado em Verificar.

O requisito não é ativado por padrão. Use-o quando praticar aquela técnica fizer parte da aprendizagem; desafios abertos continuam aceitando outras estratégias válidas. Um runner como Jest pode executar assertions e mocks, mas a inspeção de estrutura é uma responsabilidade separada.

## Formato de autoria

```json
{
  "nome": "Técnica · definir calcularGanho como arrow",
  "executar": "return true;",
  "esperado": true,
  "tecnica": {"versao": 1, "funcao": "calcularGanho", "regra": "arrow"}
}
```

O motor interpreta esse caso como análise estrutural: não executa o corpo return true para decidir sua aprovação. Regras desconhecidas ou configurações inválidas são recusadas. É obrigatório manter ao menos um caso de comportamento na questão.

## Regras e limites

- `arrow`, `declaracao`, `expressao`, `async`: forma da própria função indicada. O alvo deve ser uma declaração no nível principal ou uma variável inicializada diretamente com função; atribuições dinâmicas e aliases não são resolvidos.
- `for`: família dos laços for, inclusive for…of e for…in. `for-of`, `while`, `do-while`: a construção específica no corpo da função-alvo.
- `laco`: qualquer laço de repetição no corpo. `lacos-aninhados`: um laço cujo corpo contém outro laço; dois laços em sequência não atendem, nem um laço escondido em uma função auxiliar.
- `sem-metodo-reverse`, `sem-metodo-map`, `sem-metodo-filter`: recusam chamadas diretas desses métodos, inclusive em helpers internos da função indicada. Não resolvem aliases nem caminhos dinâmicos; preservação da entrada e resultados continuam dependendo dos testes de comportamento.
- `parametro-padrao`: exige um inicializador de parâmetro na própria função. Informe também `parametro`, por exemplo `"parametro": "taxa"`. A regra não confere o valor do padrão: teste chamadas com argumento omitido, undefined e zero quando fizerem parte do contrato.
- `chama-funcao`: exige chamada direta ao nome informado em `referencia`, por exemplo `"referencia": "somar"`. Não demonstra que a chamada contribuiu para o retorno.
- `funcao-interna-chamada`: exige uma função local declarada e chamada diretamente; `referencia` pode restringir o nome local. Não resolve aliases ou execução indireta.
- `funcao-interna-retornada`: exige retorno de uma função interna, diretamente ou por um identificador local, incluindo ramos condicionais. Não considera `return outra(interna)` como retorno da própria função interna. Persistência e independência do estado precisam de testes com chamadas intercaladas.
- `await`, `try-catch`, `finally`: a construção no corpo da função indicada. Um finally sozinho não satisfaz try-catch.
- `recursao`: presença de chamada direta pelo nome da função ou pelo nome interno de uma expressão function. Recursão indireta e aliases não são resolvidos.
- `arrow-interna`, `arrow-interna-expressao`, `arrow-interna-bloco`: variável local inicializada com arrow e uma chamada ao seu nome no corpo da função-alvo. As duas últimas distinguem retorno de expressão e corpo em bloco.
- `metodo-map`, `metodo-filter`, `metodo-find`, `metodo-toSorted`, `metodo-reduce`, `metodo-some`, `metodo-every`, `metodo-catch`: chamada de membro com esse nome no corpo da função. Tanto `.some(...)` quanto `["some"](...)` são reconhecidos; nomes calculados dinamicamente não são resolvidos. Exigir toSorted não prova o sentido ou a correção do comparador: os testes precisam conferir números, empates e preservação da entrada.

Construções em helpers internos não contam como construções do próprio corpo; a regra precisa combinar com o enunciado. Não se compara a resposta com o texto do gabarito.

A análise é estrutural, não uma prova de fluxo de dados ou de execução de cada ramo. Código inalcançável, sombreamento de nomes e métodos personalizados podem exigir inspeção do professor. Por isso a presença de uma construção não prova que ela produziu a resposta. Os testes de comportamento continuam indispensáveis; closures, por exemplo, precisam demonstrar persistência de estado e independência entre instâncias. Esta funcionalidade não é um mecanismo contra fraude.

## Distribuição e progresso

`json-parse`, `json-stringify`, `math-round` e `intl-data` exigem a chamada no namespace nativo correspondente. DateTimeFormat aceita chamada ou construção com new. `metodo-formatToParts` exige a chamada do método. `assert-node` exige require("node:assert/strict") na função-alvo; `construtor-map` e `construtor-set` exigem new Map/new Set nesse corpo. Strings, comentários e helpers não atendem. Presença não garante uso efetivo: casos de comportamento, estado e efeitos continuam obrigatórios.

Para busca binária, a aula pode fornecer um teste de leituras de posições com orçamento explícito, em vez de exigir nomes de variáveis ou tempo de execução. Isso distingue percurso linear da redução de intervalo sem reprovar outra implementação binária válida. A instrumentação do teste não é conteúdo que o aluno precise implementar.

`metodo-then` verifica chamada de membro then. `promise-resolve`, `promise-all` e `promise-allSettled` verificam chamadas ao namespace Promise no corpo indicado. Não provam por si sós ordem, espera, início de fontes ou limite de concorrência. Para esses objetivos, use fontes pendentes controladas e libere-as por etapas; teste ordem e número de chamadas, identidade de rejeição, fontes não iniciadas e barreiras entre lotes, sem medir tempo de relógio.

As regras `desestruturacao-objeto`, `desestruturacao-com-padrao`, `rest-parametro`, `rest-objeto`, `rest-array` e `spread-objeto` distinguem os contextos sintáticos. Desestruturação é reconhecida no corpo ou nos parâmetros da função-alvo; helpers internos não satisfazem o requisito. O padrão exige uma propriedade com inicializador em ObjectPattern. Rest em parâmetro não é spread em chamada; rest de array não é uma cópia com spread. Nenhuma dessas regras prova sozinha que a variável extraída ou o padrão escolhido contribuiu para o resultado: confira valores, ausência, campos permitidos, referências e mutação nos testes e na explicação do aluno.

A próxima versão do runtime com esse recurso é **0.15.0**. Aulas com técnica exigida são exportadas no formato 4; versões antigas que só aceitam formato 3 recusam a importação. O acervo online exige no mínimo 0.15.0 para essas aulas. Atualize aplicativo e API antes de publicá-las. Não há liberação automática de conteúdos por acrescentar um requisito.

Adicionar ou mudar uma regra técnica exige nova verificação da questão. O código salvo do aluno permanece preservado. Questões antigas, sem requisito técnico, conservam o funcionamento anterior.
