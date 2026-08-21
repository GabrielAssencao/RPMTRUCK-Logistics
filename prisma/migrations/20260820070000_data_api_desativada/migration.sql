-- Workaround oficial para evitar o erro 3F000 recorrente quando a Data API
-- está desativada no Dashboard do Supabase. O schema exposto fica vazio.
CREATE SCHEMA IF NOT EXISTS "pgrst_no_exposed_schemas";

REVOKE ALL ON SCHEMA "pgrst_no_exposed_schemas" FROM PUBLIC;
REVOKE ALL ON SCHEMA "pgrst_no_exposed_schemas" FROM anon;
REVOKE ALL ON SCHEMA "pgrst_no_exposed_schemas" FROM authenticated;

ALTER ROLE authenticator SET pgrst.db_schemas = 'pgrst_no_exposed_schemas';
NOTIFY pgrst, 'reload config';

COMMENT ON SCHEMA "pgrst_no_exposed_schemas" IS
  'Schema vazio usado enquanto a Data API do Supabase permanece desativada.';
