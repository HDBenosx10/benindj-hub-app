# Enviar e receber várias aulas

No **Professor**, abra **Acervo → Selecionar aulas para exportar**. Marque as aulas desejadas e clique em **Exportar selecionadas**. “Marcar visíveis” considera a busca e o filtro atuais; a seleção permanece ao mudar o filtro. “Limpar seleção” remove todas as marcações, inclusive as ocultas pelo filtro.

O resultado é um único arquivo `.aulas-hub`. Ele contém somente as aulas escolhidas, sem o campo privado do professor. Dependências e aulas posteriores não são adicionadas automaticamente. A exportação individual continua disponível.

No **Aluno**, clique em **Importar aulas** e selecione um pacote ou vários arquivos `.aula-hub`/`.json`. Confira a lista e confirme a seleção. Aulas novas vêm marcadas; uma aula existente com conteúdo diferente exige marcação explícita. Arquivos inválidos e ids duplicados são informados e não impedem a importação das outras aulas válidas. Respostas devem ser importadas separadamente.

Uma atualização preserva respostas e bancos salvos em arquivo. O conteúdo anterior fica no histórico local; se os critérios forem alterados pelo professor, o aluno pode precisar verificar novamente. Se a configuração dos recursos mudar, a revisão avisa que os serviços serão reiniciados e que dados apenas em memória poderão ser reinicializados. Uma revisão apenas do texto mantém o ambiente ativo. Recursos novos são preparados ao abrir a aula, em vez de iniciar todos os bancos e serviços durante a importação.

Limites por lote: 100 aulas e 32 MB de conteúdo; uma aula individual pode ter até 4 MB. A revisão expira em dez minutos. Antes da confirmação, Cancelar não grava alterações.

As alterações estão locais. A associação de `.aulas-hub` ao aplicativo no Windows depende de uma futura geração e instalação da versão; não foi produzido um novo instalador nesta etapa. A importação pelo botão do aplicativo independe dessa associação.
