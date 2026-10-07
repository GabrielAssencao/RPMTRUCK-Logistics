BEGIN;

ALTER TABLE public.mfa_admin
  ADD COLUMN obrigatorio BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN redefinido_em TIMESTAMP(3);

CREATE TABLE public.dispositivos_confiaveis (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent_hash TEXT NOT NULL,
  ip_hash TEXT,
  acessos_restantes INTEGER NOT NULL DEFAULT 10,
  expira_em TIMESTAMP(3) NOT NULL,
  ultimo_acesso_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revogado_em TIMESTAMP(3)
);

CREATE INDEX dispositivos_confiaveis_usuario_expira_idx
  ON public.dispositivos_confiaveis(usuario_id, expira_em);

ALTER TABLE public.dispositivos_confiaveis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dispositivos_confiaveis FROM PUBLIC, anon, authenticated;

COMMIT;
