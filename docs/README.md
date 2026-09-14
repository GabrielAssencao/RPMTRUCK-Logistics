# Documentação do projeto

- [README principal](../README.md): instalação, arquitetura, ambientes e deploy.
- [Base de desenvolvimento](base-desenvolvimento-2026-09-12.md): checkpoint preservado da versão validada.
- [Revisão de segurança](security-review-2026-09-12.md): correções, evidências e limitações da auditoria.
- [Backup de produção](backup-producao.md): cópia criptografada e recuperação isolada.
- [Scripts operacionais](../scripts/README.md): inventário e cuidados com operações sensíveis.
- [Ciclo financeiro local](ciclo-financeiro-local.md): pagamento inicial, vencimentos e preparação para o gateway.

Documentação não deve conter credenciais, dados de clientes, dumps ou chaves de recuperação. Exemplos de ambiente ficam apenas em `.env.example` e `.env.local.example`, com valores fictícios.

Os lembretes pessoais permitem marcar como concluído e escolher, por usuário, a exclusão após 1, 7, 30 ou 90 dias da conclusão. Por padrão, são mantidos. Reabrir cancela o prazo; concluir novamente inicia outro. A migração `20260913000000_retencao_lembretes` deve ser aplicada antes do deploy. A limpeza ocorre ao carregar o quadro e pelo cron diário existente em `/api/internal/retencao`, que exige `CRON_SECRET` com pelo menos 32 caracteres. As notificações vinculadas são excluídas em cascata.

O painel admin inclui Cronograma com lembretes pessoais e calendário mensal, sem quadro de tarefas. A migração `20260913010000_lembretes_admin` permite empresa nula nos lembretes internos; o acesso continua limitado ao usuário autenticado. Os avisos do admin são entregues pela central de notificações existente.

O plano Essencial inclui o módulo Cronograma com lembretes pessoais e calendário mensal. As APIs de tarefas exigem a capacidade `delegacaoTarefas`, disponível nos planos Avançado, Enterprise e Preview. A migração `20260913020000_cronograma_essencial` libera o módulo para empresas Essenciais existentes e preserva as permissões individuais dos usuários.
