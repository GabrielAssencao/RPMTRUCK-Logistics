ALTER TABLE "usuarios"
ADD COLUMN "estilo_fundo" VARCHAR(24);

ALTER TABLE "usuarios"
ADD CONSTRAINT "usuarios_estilo_fundo_check"
CHECK (
  "estilo_fundo" IS NULL
  OR "estilo_fundo" IN ('DESLIGADO', 'DIGITAL', 'TOPOGRAFICO', 'VIDRO_FLUIDO', 'VIDRO_CAMADAS', 'ORGANICO')
);

COMMENT ON COLUMN "usuarios"."estilo_fundo" IS
  'Fundo visual individual; nulo herda a escolha do gestor da empresa.';
