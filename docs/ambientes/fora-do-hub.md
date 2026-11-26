# Material complementar e saída da plataforma

A aba Fora do Hub tem duas funções: aprofundar o conteúdo da aula e permitir que o aluno reproduza o projeto em um editor comum. O botão Exportar projeto gera um ZIP offline com código atual, configuração dos recursos, critérios públicos, runner Node e LEIA-ME.md. Não inclui gabaritos, chaves da API OpenAI ou dados experimentais do banco.

## Roteiro de reprodução

1. Instalar Node 24.13 ou superior.
2. Extrair o ZIP e abrir a pasta no editor.
3. Executar `node iniciar.cjs`. Para uma atividade de função específica, usar `node iniciar.cjs ID`.
4. Em projeto HTTP, abrir `http://127.0.0.1:3000` com um cliente HTTP; usar Ctrl+C para encerrar.
5. Executar `node verificar.cjs` para rodar os critérios públicos em ambientes isolados.
6. Ler o runner e seguir a passagem de dependências. A pasta `.hub` contém JavaScript comum, sem Electron e sem instalação de pacotes.

Os recursos recomeçam com a configuração e os dados iniciais. SQL executado só no painel e documentos inseridos só durante experimentos não viram automaticamente código exportado. Se a construção do banco for parte da entrega, registre-a num arquivo SQL ou no programa.

Em oficinas com comandos, escolha `node iniciar.cjs ID-DO-COMANDO`, usando os ids de `aula.json`. Em HTTP, `iniciar.cjs` é o driver que prepara recursos; a entrada original da aula fica em `entrada.cjs` para leitura. Quando há `config.cjs`, o driver valida a configuração antes de iniciar. `verificar.cjs` usa a entrada original nos cenários isolados. O ZIP inclui o avaliador de técnicas e seu parser para funcionar sem instalar pacotes.

## Material que o professor deve produzir

**Guia:** explique o problema, os conhecimentos necessários, o fluxo dos dados, o estado e o significado dos erros. Inclua perguntas que peçam uma previsão e evidências para investigar.

**Fora da plataforma:** forneça comandos, estrutura de arquivos, portas e exemplos de requisição. Mostre como iniciar, verificar, encerrar e reconstruir as dependências. Depois proponha substituir um adaptador por uma implementação própria.

**Transferência:** mude domínio ou restrição; peça um teste novo, um erro esperado e uma decisão explicada. Um aluno que só repete o exemplo ainda não demonstrou autonomia.

**Referências:** selecione documentação oficial que explique as APIs efetivamente usadas. Indique o trecho ou assunto a buscar e uma tarefa de leitura, não apenas uma lista de links.

O modelo de projeto back-end já contém um roteiro de SQL, integração, timeout, concorrência e reconstrução no Node para o professor adaptar. Os formulários e a IA ajudam a escrever; a curadoria final continua sendo do professor.
