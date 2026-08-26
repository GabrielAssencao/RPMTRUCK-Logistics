# Como contribuir

1. Abra uma issue para alinhar mudanças de comportamento ou arquitetura.
2. Crie uma branch curta a partir de `main`.
3. Preserve o isolamento multiempresa e derive identidade e empresa da sessão.
4. Nunca inclua `.env`, credenciais, dados pessoais ou dumps de banco.
5. Adicione regressões para correções de segurança e comportamento crítico.
6. Execute `npm run typecheck`, `npm run lint`, `npm run test:security`,
   `npm run prisma:validate` e `npm run build`.
7. Envie um pull request pequeno, com motivação, riscos e evidências de validação.

Vulnerabilidades devem seguir `SECURITY.md`, e não o fluxo público de issues.
