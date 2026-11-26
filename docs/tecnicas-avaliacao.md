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
- `sem-metodo-reverse`: recusa chamadas diretas de `.reverse()` ou `["reverse"]()`, inclusive em helpers internos da função indicada. Não resolve aliases nem caminhos dinâmicos; a preservação e a identidade da saída também precisam de testes de comportamento.
- `await`, `try-catch`, `finally`: a construção no corpo da função indicada. Um finally sozinho não satisfaz try-catch.
- `recursao`: presença de chamada direta pelo nome da função ou pelo nome interno de uma expressão function. Recursão indireta e aliases não são resolvidos.
- `arrow-interna`, `arrow-interna-expressao`, `arrow-interna-bloco`: variável local inicializada com arrow e uma chamada ao seu nome no corpo da função-alvo. As duas últimas distinguem retorno de expressão e corpo em bloco.
- `metodo-map`, `metodo-filter`, `metodo-find`, `metodo-reduce`, `metodo-some`, `metodo-every`, `metodo-catch`: chamada de membro com esse nome no corpo da função. Tanto `.some(...)` quanto `["some"](...)` são reconhecidos; nomes calculados dinamicamente não são resolvidos.

Construções em helpers internos não contam como construções do próprio corpo; a regra precisa combinar com o enunciado. Não se compara a resposta com o texto do gabarito.

A análise é estrutural, não uma prova de fluxo de dados ou de execução de cada ramo. Código inalcançável, sombreamento de nomes e métodos personalizados podem exigir inspeção do professor. Por isso a presença de uma construção não prova que ela produziu a resposta. Os testes de comportamento continuam indispensáveis; closures, por exemplo, precisam demonstrar persistência de estado e independência entre instâncias. Esta funcionalidade não é um mecanismo contra fraude.

## Distribuição e progresso

A próxima versão do runtime com esse recurso é **0.15.0**. Aulas com técnica exigida são exportadas no formato 4; versões antigas que só aceitam formato 3 recusam a importação. O acervo online exige no mínimo 0.15.0 para essas aulas. Atualize aplicativo e API antes de publicá-las. Não há liberação automática de conteúdos por acrescentar um requisito.

Adicionar ou mudar uma regra técnica exige nova verificação da questão. O código salvo do aluno permanece preservado. Questões antigas, sem requisito técnico, conservam o funcionamento anterior.
