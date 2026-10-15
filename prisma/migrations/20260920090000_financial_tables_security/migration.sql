-- These tables are accessed exclusively by the trusted backend through Prisma.
-- Browser/API roles must not bypass application tenant and admin authorization.
BEGIN;

ALTER TABLE public.recorrencias_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_plataforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocoes_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_pix_promocoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_pix_planos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.recorrencias_pagamento,
  public.despesas_plataforma,
  public.promocoes_comerciais,
  public.configuracoes_pix_promocoes,
  public.configuracoes_pix_planos
FROM PUBLIC, anon, authenticated;

COMMIT;
