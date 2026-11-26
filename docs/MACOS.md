# BeninDJ Hub no macOS

Escolha `macOS-arm64.dmg` para Apple Silicon (M1 e posteriores), ou `macOS-x64.dmg` para Intel. Em Sobre Este Mac, confira o campo Chip ou Processador. O ZIP contém o mesmo aplicativo para instalação manual.

Abra o DMG e arraste o aplicativo para Aplicativos. Abra-o a partir de Aplicativos. O Node e o npm necessários ao laboratório já estão incluídos; não é preciso instalá-los. A oficina de Git requer o Git do sistema.

Esta primeira distribuição usa assinatura ad-hoc, sem certificado Developer ID e sem notarização Apple. O macOS pode bloquear a primeira abertura: após tentar abrir, acesse Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim e confirme o aplicativo que você acabou de baixar. Não desative a proteção global do macOS. Referência: https://support.apple.com/pt-br/102445.

Atualizações do aplicativo no Mac são manuais nesta versão: feche o Hub e substitua o aplicativo em Aplicativos pelo novo. Respostas, progresso e aulas ficam em `~/Library/Application Support/BeninDJ Hub Aluno` ou `~/Library/Application Support/BeninDJ Hub Professor`, separadamente. Não exclua essas pastas.

Atualização de aulas pelo acervo e convites funciona independentemente do updater do aplicativo. O Aluno começa apenas com Hello World. O Professor e seus materiais são distribuídos somente no repositório privado.

Cada arquitetura acompanha um manifesto JSON e sua assinatura Ed25519 `.sig`, com hashes SHA-256 dos dois arquivos e os commits usados na montagem. Essa assinatura de integridade não substitui a notarização Apple. A CI verifica execução do aplicativo, debugger, SQLite e persistência em cada arquitetura. A aceitação pelo Gatekeeper em um Mac de usuário exige validação manual da primeira abertura.
