ALTER TABLE public.auditoria_logs
  DROP CONSTRAINT IF EXISTS auditoria_logs_acao_check;

ALTER TABLE public.auditoria_logs
  ADD CONSTRAINT auditoria_logs_acao_check
  CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'EXPORTACAO_PRE_EXCLUSAO'));
