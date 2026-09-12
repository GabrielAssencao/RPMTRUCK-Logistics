# Backup manual antes da publicação

O script `scripts/backup-production.mjs` lê a produção sem aplicar migrações. Usa um snapshot consistente para o dump do schema `public` e verifica as contagens das tabelas em um PostgreSQL temporário local. Copia também os objetos do Storage, os metadados dos buckets e o `.env` de produção, necessário para recuperar credenciais e dados criptografados da aplicação.

## Executar no Windows

Use binários PostgreSQL compatíveis, obtidos do distribuidor oficial. Execute da raiz do projeto com `.env` configurado para produção:

```powershell
node --env-file=.env scripts/backup-production.mjs --pg-bin=C:\caminho\pgsql\bin --backup-root=C:\BackupsRPMTruck --key-root=C:\ChavesRPMTruck
```

Use pastas dedicadas: a ferramenta restringe suas permissões ao usuário Windows atual. As pastas devem ficar fora do repositório e não podem estar uma dentro da outra. Não use pastas compartilhadas ou diretórios gerais como destino.

Cada execução cria uma pasta datada com dump, ambiente, manifesto e anexos criptografados por AES-256-GCM. A chave hexadecimal fica na outra pasta, **não criptografada**, protegida por permissões do Windows. Não a envie por chat nem a inclua na cópia da pasta de backup. Sem essa chave não existe recuperação.

`verification.json` registra o teste de restauração e integridade. Confirme também que o comando terminou com sucesso e encerrou/removou o cluster temporário. Um erro torna a execução inadequada como requisito para publicação.

Copie o backup criptografado para outro dispositivo ou armazenamento externo confiável e guarde a chave separadamente. Uma cópia apenas no mesmo computador não protege contra perda desse computador. Faça backups regulares; este procedimento não oferece recuperação contínua nem backup automático.

## Recuperação offline de um arquivo

```powershell
node scripts/decrypt-backup-file.mjs --input=C:\BackupsRPMTruck\production-DATA\database.dump.enc --key=C:\ChavesRPMTruck\production-DATA.key --output-directory=C:\RecuperacaoRPMTruck
```

O arquivo ganha o sufixo `.recovered`. Use uma pasta dedicada fora do repositório; arquivos existentes não são sobrescritos. Recupere `manifest.json.enc` para identificar nomes originais e buckets dos anexos `object-N.enc`. Recupere `environment.env.enc` somente quando necessário e trate seu conteúdo como segredo. Exclua cópias em texto claro quando não forem mais necessárias.

Antes de uma restauração real, confirme o destino, versão, roles, extensões e dependências. Teste primeiro em ambiente isolado. Não execute `pg_restore` contra produção por tentativa. O script não reenvia objetos ao Storage; sua recuperação exige recriar os buckets conforme o manifesto e enviar os arquivos aos caminhos originais com autorização explícita.

## Limites

Este é um backup da aplicação, **não de toda a plataforma Supabase**: não inclui schemas `auth`, `vault`, configurações do projeto, usuários do Supabase Auth ou funções externas. O teste local ignora proprietários e privilégios e usa roles auxiliares, portanto não valida uma restauração completa das permissões Supabase. Políticas e migrações precisam ser verificadas no ambiente de destino. As linhas são conferidas por contagem; os arquivos são conferidos por autenticação GCM e SHA-256.

Banco e Storage não compartilham uma transação única. O script rejeita alterações nos metadados dos objetos durante a cópia; prefira uma janela sem gravações para backups antes de migrações.

Referências: [backups Supabase](https://supabase.com/docs/guides/platform/backups) e [binários oficiais PostgreSQL para Windows](https://www.postgresql.org/download/windows/).
