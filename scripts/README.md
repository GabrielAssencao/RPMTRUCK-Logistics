# Scripts operacionais

Os nomes e caminhos foram preservados para manter os comandos npm e procedimentos existentes compatíveis.

| Responsabilidade | Scripts |
| --- | --- |
| Ambiente isolado | `verify-local-environment.mjs`, `create-local-admin.mjs` |
| Auditorias somente leitura | `audit-git-secrets.mjs`, `audit-local-security.mjs`, `audit-sensitive-data-versions.mjs` |
| Criptografia e rotação | `generate-data-encryption-keys.mjs`, `encrypt-sensitive-data.mjs`, `rotate-sensitive-data-keys.mjs` |
| Backup e recuperação offline | `backup-production.mjs`, `decrypt-backup-file.mjs`, `protect-backup-directory.ps1` |
| Utilidades internas | `lib/backup-crypto.mjs` |

Consulte os comandos em `package.json` e [backup de produção](../docs/backup-producao.md). Scripts com `--apply` podem alterar dados; simule antes e confirme ambiente, backup e autorização. A geração de chaves imprime segredos: use um terminal privado e nunca copie a saída para Git, logs ou chat.

`npm run test:unit` executa todas as regressões locais em `tests/*.test.mjs`; `npm run test:local` acrescenta tipos e lint. E2E permanece separado em `tests/e2e/`.
