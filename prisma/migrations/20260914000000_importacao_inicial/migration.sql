CREATE TABLE public.importacoes_iniciais (
  id TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  dados TEXT,
  resumo JSONB NOT NULL,
  checksum TEXT NOT NULL,
  "enviadoPorId" TEXT NOT NULL,
  "revisadoPorId" TEXT,
  motivo TEXT,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP(3) NOT NULL,
  aprovado_em TIMESTAMP(3),
  CONSTRAINT importacoes_iniciais_pkey PRIMARY KEY (id),
  CONSTRAINT importacoes_iniciais_empresa_fkey FOREIGN KEY ("empresaId") REFERENCES public.empresas(id) ON DELETE CASCADE,
  CONSTRAINT importacoes_iniciais_status_check CHECK (status IN ('PENDENTE', 'REJEITADO', 'APROVADO')),
  CONSTRAINT importacoes_iniciais_payload_check CHECK ((status = 'PENDENTE' AND dados IS NOT NULL) OR (status <> 'PENDENTE' AND dados IS NULL))
);
CREATE UNIQUE INDEX importacoes_iniciais_empresa_key ON public.importacoes_iniciais("empresaId");
CREATE INDEX importacoes_iniciais_status_data_idx ON public.importacoes_iniciais(status, criado_em);
ALTER TABLE public.importacoes_iniciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.importacoes_iniciais FROM anon, authenticated;
-- Only the existing trusted backend database connection accesses this queue.
CREATE FUNCTION public.rpm_auditar_importacao_inicial() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'APROVADO' THEN
    RAISE EXCEPTION 'Initial import already approved';
  END IF;
  INSERT INTO public.auditoria_logs (
    tabela, acao, registro_id, empresa_id, usuario_id, dados_anteriores, dados_novos, origem
  ) VALUES (
    TG_TABLE_NAME, TG_OP, NEW.id, NEW."empresaId",
    NULLIF(current_setting('rpm.usuario_id', true), ''),
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('status', OLD.status, 'checksum', OLD.checksum) ELSE NULL END,
    jsonb_build_object('status', NEW.status, 'checksum', NEW.checksum, 'resumo', NEW.resumo),
    COALESCE(NULLIF(current_setting('rpm.origem', true), ''), 'DATABASE')
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpm_auditar_importacao_inicial() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER auditar_importacao_inicial BEFORE INSERT OR UPDATE ON public.importacoes_iniciais
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_importacao_inicial();
