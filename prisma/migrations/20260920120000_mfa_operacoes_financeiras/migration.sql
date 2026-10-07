BEGIN;
CREATE TABLE public.mfa_admin (
  usuario_id TEXT PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  segredo TEXT NOT NULL,
  ativado_em TIMESTAMP(3),
  ultimo_contador INTEGER NOT NULL DEFAULT -1,
  recuperacao TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  desafio_hash TEXT,
  desafio_expira_em TIMESTAMP(3)
);
CREATE TABLE public.operacoes_financeiras (
  empresa_id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  criada_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.mfa_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_financeiras ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mfa_admin, public.operacoes_financeiras FROM PUBLIC, anon, authenticated;
COMMIT;
