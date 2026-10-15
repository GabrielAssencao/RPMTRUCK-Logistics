CREATE TYPE "EscopoPromocaoComercial" AS ENUM ('NOVAS_EMPRESAS', 'TODAS_EMPRESAS', 'EMPRESAS_ATIVAS');

CREATE TABLE "promocoes_comerciais" (
  "id" TEXT NOT NULL, "nome" TEXT NOT NULL, "grupo" TEXT, "descricao" TEXT, "escopo" "EscopoPromocaoComercial" NOT NULL,
  "plano" "PlanoTipo" NOT NULL, "preco_base_inicial" DECIMAL(12,2) NOT NULL, "meses_preco_inicial" INTEGER NOT NULL,
  "preco_base_renovacao" DECIMAL(12,2) NOT NULL, "taxa_implantacao" DECIMAL(12,2) NOT NULL,
  "limite_adesoes" INTEGER, "adesoes_confirmadas" INTEGER NOT NULL DEFAULT 0, "ativa" BOOLEAN NOT NULL DEFAULT true,
  "visivel_solicitacao" BOOLEAN NOT NULL DEFAULT false, "inicio" TIMESTAMP(3), "fim" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promocoes_comerciais_pkey" PRIMARY KEY ("id"), CONSTRAINT "promocoes_comerciais_nome_key" UNIQUE ("nome")
);
CREATE INDEX "promocoes_comerciais_ativa_visivel_solicitacao_plano_idx" ON "promocoes_comerciais"("ativa", "visivel_solicitacao", "plano");
CREATE INDEX "promocoes_comerciais_grupo_ativa_idx" ON "promocoes_comerciais"("grupo", "ativa");

ALTER TABLE "solicitacoes_acesso" ADD COLUMN "promocao_id" TEXT, ADD COLUMN "preco_base_promocional" DECIMAL(12,2), ADD COLUMN "preco_base_renovacao" DECIMAL(12,2), ADD COLUMN "promocao_meses_iniciais" INTEGER, ADD COLUMN "taxa_implantacao_promocional" DECIMAL(12,2);
ALTER TABLE "empresas" ADD COLUMN "promocao_id" TEXT, ADD COLUMN "preco_base_promocional" DECIMAL(12,2), ADD COLUMN "preco_base_renovacao" DECIMAL(12,2), ADD COLUMN "promocao_meses_iniciais" INTEGER, ADD COLUMN "promocao_ativada_em" TIMESTAMP(3), ADD COLUMN "taxa_implantacao_contratada" DECIMAL(12,2);
ALTER TABLE "solicitacoes_acesso" ADD CONSTRAINT "solicitacoes_acesso_promocao_id_fkey" FOREIGN KEY ("promocao_id") REFERENCES "promocoes_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_promocao_id_fkey" FOREIGN KEY ("promocao_id") REFERENCES "promocoes_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "configuracoes_pix_planos" (
  "id" TEXT NOT NULL, "plano" "PlanoTipo" NOT NULL, "tipo_fatura" TEXT NOT NULL, "valor" DECIMAL(12,2) NOT NULL,
  "pix_copia_e_cola" TEXT, "qr_path" TEXT NOT NULL, "qr_nome" TEXT NOT NULL, "qr_mime" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true, "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "configuracoes_pix_planos_pkey" PRIMARY KEY ("id"), CONSTRAINT "configuracoes_pix_planos_plano_tipo_fatura_valor_key" UNIQUE ("plano", "tipo_fatura", "valor")
);

ALTER TABLE "faturas" ADD COLUMN "pix_copia_e_cola" TEXT, ADD COLUMN "pix_qr_path" TEXT, ADD COLUMN "pix_qr_nome" TEXT, ADD COLUMN "pix_qr_mime" TEXT, ADD COLUMN "comprovante_path" TEXT, ADD COLUMN "comprovante_nome" TEXT, ADD COLUMN "comprovante_mime" TEXT, ADD COLUMN "comprovante_tamanho" INTEGER, ADD COLUMN "comprovante_enviado_em" TIMESTAMP(3), ADD COLUMN "comprovante_enviado_por_id" TEXT;
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_comprovante_enviado_por_id_fkey" FOREIGN KEY ("comprovante_enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "faturas_comprovante_enviado_por_id_idx" ON "faturas"("comprovante_enviado_por_id");

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cobrancas-pix-privadas', 'cobrancas-pix-privadas', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO "promocoes_comerciais" ("id", "nome", "grupo", "descricao", "escopo", "plano", "preco_base_inicial", "meses_preco_inicial", "preco_base_renovacao", "taxa_implantacao", "limite_adesoes", "ativa", "visivel_solicitacao", "atualizado_em")
VALUES
  (gen_random_uuid()::text, 'Fundadoras - Essencial', 'FUNDADORAS', 'Condição de lançamento para as cinco primeiras empresas aprovadas no plano Essencial.', 'NOVAS_EMPRESAS', 'ESSENCIAL', 297.00, 12, 397.00, 390.00, 5, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Fundadoras - Avançado', 'FUNDADORAS', 'Condição de lançamento para as cinco primeiras empresas aprovadas no plano Avançado.', 'NOVAS_EMPRESAS', 'AVANCADO', 497.00, 12, 637.00, 590.00, 5, true, true, CURRENT_TIMESTAMP);

UPDATE "planos_comerciais" SET "preco_base" = 497.00, "taxa_implantacao" = 490.00, "preco_usuario_adicional" = 35.00, "preco_veiculo_adicional" = 45.00, "versao" = "versao" + 1 WHERE "plano" = 'ESSENCIAL';
UPDATE "planos_comerciais" SET "preco_base" = 797.00, "taxa_implantacao" = 790.00, "preco_usuario_adicional" = 35.00, "preco_veiculo_adicional" = 45.00, "versao" = "versao" + 1 WHERE "plano" = 'AVANCADO';
UPDATE "planos_comerciais" SET "preco_base" = 1490.00, "taxa_implantacao" = 1490.00, "versao" = "versao" + 1 WHERE "plano" = 'ENTERPRISE';
