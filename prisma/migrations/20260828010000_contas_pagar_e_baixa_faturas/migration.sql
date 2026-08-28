CREATE TYPE "StatusContaPagar" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');
CREATE TYPE "OrigemLeituraBoleto" AS ENUM ('MANUAL', 'PDF_TEXTO', 'CODIGO_BARRAS');

ALTER TABLE "empresas"
  ADD COLUMN "portal_financeiro_nome" TEXT,
  ADD COLUMN "portal_financeiro_url" TEXT;

ALTER TABLE "faturas"
  ADD COLUMN "pago_em" TIMESTAMP(3),
  ADD COLUMN "pago_por_id" TEXT;

CREATE TABLE "contas_pagar" (
  "id" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "fornecedor" TEXT,
  "vencimento" DATE NOT NULL,
  "valor" DECIMAL(12,2) NOT NULL,
  "status" "StatusContaPagar" NOT NULL DEFAULT 'PENDENTE',
  "linha_digitavel" TEXT,
  "origem_leitura" "OrigemLeituraBoleto" NOT NULL DEFAULT 'MANUAL',
  "boleto_path" TEXT,
  "boleto_nome" TEXT,
  "boleto_mime" TEXT,
  "boleto_tamanho" INTEGER,
  "comprovante_path" TEXT,
  "comprovante_nome" TEXT,
  "comprovante_mime" TEXT,
  "comprovante_tamanho" INTEGER,
  "pago_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  "empresaId" TEXT NOT NULL,
  "criado_por_id" TEXT,
  "pago_por_id" TEXT,
  CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "faturas_pago_por_id_idx" ON "faturas"("pago_por_id");
CREATE INDEX "contas_pagar_empresaId_status_vencimento_idx" ON "contas_pagar"("empresaId", "status", "vencimento");
CREATE INDEX "contas_pagar_empresaId_criado_em_idx" ON "contas_pagar"("empresaId", "criado_em");
CREATE INDEX "contas_pagar_criado_por_id_idx" ON "contas_pagar"("criado_por_id");
CREATE INDEX "contas_pagar_pago_por_id_idx" ON "contas_pagar"("pago_por_id");

ALTER TABLE "faturas"
  ADD CONSTRAINT "faturas_pago_por_id_fkey"
  FOREIGN KEY ("pago_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contas_pagar"
  ADD CONSTRAINT "contas_pagar_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contas_pagar"
  ADD CONSTRAINT "contas_pagar_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contas_pagar"
  ADD CONSTRAINT "contas_pagar_pago_por_id_fkey"
  FOREIGN KEY ("pago_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contas-pagar',
  'contas-pagar',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- O bucket permanece sem policies para anon/authenticated. Os arquivos somente
-- são acessados pelo backend com service role e URLs assinadas de curta duração.
