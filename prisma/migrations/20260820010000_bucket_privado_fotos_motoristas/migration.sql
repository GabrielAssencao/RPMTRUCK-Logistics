-- Fotos de motoristas são dados pessoais e permanecem em bucket privado.
-- O navegador nunca envia diretamente ao Storage: a API autentica, processa e salva WebP 3:4.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    ) VALUES (
      'motoristas-fotos',
      'motoristas-fotos',
      false,
      204800,
      ARRAY['image/webp']::TEXT[]
    )
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

