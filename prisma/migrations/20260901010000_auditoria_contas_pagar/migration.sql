-- Contas a pagar foi criada depois da instalação inicial da auditoria geral.
-- O trigger registra inclusive baixa, cancelamento e reversão com o usuário
-- associado pela transação de executarComAuditoria.
DROP TRIGGER IF EXISTS "auditar_contas_pagar" ON public."contas_pagar";

CREATE TRIGGER "auditar_contas_pagar"
AFTER INSERT OR UPDATE OR DELETE ON public."contas_pagar"
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao();
