CREATE TABLE "configuracoes_pix_promocoes" (
  "id" TEXT NOT NULL,
  "promocao_id" TEXT NOT NULL,
  "tipo_fatura" TEXT NOT NULL,
  "pix_copia_e_cola" TEXT,
  "qr_path" TEXT NOT NULL,
  "qr_nome" TEXT NOT NULL,
  "qr_mime" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "configuracoes_pix_promocoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "configuracoes_pix_promocoes_promocao_id_tipo_fatura_key"
  ON "configuracoes_pix_promocoes"("promocao_id", "tipo_fatura");

CREATE INDEX "configuracoes_pix_promocoes_promocao_id_idx"
  ON "configuracoes_pix_promocoes"("promocao_id");

ALTER TABLE "configuracoes_pix_promocoes"
  ADD CONSTRAINT "configuracoes_pix_promocoes_promocao_id_fkey"
  FOREIGN KEY ("promocao_id") REFERENCES "promocoes_comerciais"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
