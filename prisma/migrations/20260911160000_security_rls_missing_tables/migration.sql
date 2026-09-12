-- A aplicação autentica pelo servidor (JWT próprio + Prisma), não pelo papel
-- anon/authenticated do PostgREST. Nenhuma tabela operacional é pública.
ALTER TABLE public.conversas_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes_pessoais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.conversas_suporte, public.mensagens_suporte,
  public.alertas_sistema, public.alertas_leituras, public.lembretes_pessoais, public.contas_pagar FROM PUBLIC;
DO $$
DECLARE papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.conversas_suporte, public.mensagens_suporte, public.alertas_sistema, public.alertas_leituras, public.lembretes_pessoais, public.contas_pagar FROM %I', papel);
    END IF;
  END LOOP;
END $$;
