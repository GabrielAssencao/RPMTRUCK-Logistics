-- A visao geral e opt-in para operadores e visualizadores.
-- Gestores continuam autorizados pelo papel, independentemente deste campo.
ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "acesso_dashboard_geral" BOOLEAN NOT NULL DEFAULT false;
