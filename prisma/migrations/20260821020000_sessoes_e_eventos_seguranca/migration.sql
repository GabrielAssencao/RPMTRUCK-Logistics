CREATE TYPE "EventoSegurancaTipo" AS ENUM (
  'LOGIN_SUCESSO', 'LOGIN_FALHA', 'LOGOUT',
  'RATE_LIMIT', 'BOT_REJEITADO', 'SESSAO_REVOGADA'
);

CREATE TABLE public.sessoes_usuario (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  usuario_id TEXT NOT NULL,
  empresa_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_atividade TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMP(3) NOT NULL,
  revogada_em TIMESTAMP(3),
  CONSTRAINT sessoes_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT sessoes_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE,
  CONSTRAINT sessoes_usuario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL
);

CREATE TABLE public.eventos_seguranca (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  tipo "EventoSegurancaTipo" NOT NULL,
  usuario_id TEXT,
  empresa_id TEXT,
  email_hash TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  contexto JSONB,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT eventos_seguranca_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_seguranca_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT eventos_seguranca_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL
);

CREATE INDEX sessoes_usuario_usuario_id_expira_em_idx ON public.sessoes_usuario(usuario_id, expira_em);
CREATE INDEX sessoes_usuario_empresa_id_ultima_atividade_idx ON public.sessoes_usuario(empresa_id, ultima_atividade);
CREATE INDEX sessoes_usuario_ultima_atividade_revogada_em_idx ON public.sessoes_usuario(ultima_atividade, revogada_em);
CREATE INDEX eventos_seguranca_tipo_criado_em_idx ON public.eventos_seguranca(tipo, criado_em);
CREATE INDEX eventos_seguranca_usuario_id_criado_em_idx ON public.eventos_seguranca(usuario_id, criado_em);
CREATE INDEX eventos_seguranca_empresa_id_criado_em_idx ON public.eventos_seguranca(empresa_id, criado_em);
CREATE INDEX eventos_seguranca_ip_hash_criado_em_idx ON public.eventos_seguranca(ip_hash, criado_em);

ALTER TABLE public.sessoes_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_seguranca ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.sessoes_usuario FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.eventos_seguranca FROM PUBLIC;
DO $$
DECLARE papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.sessoes_usuario FROM %I', papel);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.eventos_seguranca FROM %I', papel);
    END IF;
  END LOOP;
END;
$$;

CREATE TRIGGER eventos_seguranca_imutaveis
BEFORE UPDATE OR DELETE ON public.eventos_seguranca
FOR EACH ROW EXECUTE FUNCTION public.rpm_bloquear_alteracao_auditoria();
