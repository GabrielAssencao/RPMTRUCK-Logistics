CREATE TYPE "TipoSolicitacaoAssinatura" AS ENUM (
  'ALTERAR_PLANO',
  'ALTERAR_COTAS',
  'NEGOCIAR_PAGAMENTO'
);

CREATE TYPE "StatusSolicitacaoAssinatura" AS ENUM (
  'PENDENTE',
  'APROVADA',
  'REJEITADA'
);

CREATE TABLE "planos_comerciais" (
  "plano" "PlanoTipo" NOT NULL,
  "preco_base" DECIMAL(12,2) NOT NULL,
  "taxa_implantacao" DECIMAL(12,2) NOT NULL,
  "preco_usuario_adicional" DECIMAL(12,2) NOT NULL,
  "preco_veiculo_adicional" DECIMAL(12,2) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "visivel_landing" BOOLEAN NOT NULL DEFAULT true,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planos_comerciais_pkey" PRIMARY KEY ("plano"),
  CONSTRAINT "planos_comerciais_valores_check" CHECK (
    "preco_base" >= 0 AND
    "preco_base" <= 1000000000 AND
    "taxa_implantacao" >= 0 AND
    "taxa_implantacao" <= 1000000000 AND
    "preco_usuario_adicional" >= 0 AND
    "preco_usuario_adicional" <= 80000 AND
    "preco_veiculo_adicional" >= 0 AND
    "preco_veiculo_adicional" <= 80000
  )
);

INSERT INTO "planos_comerciais" (
  "plano", "preco_base", "taxa_implantacao",
  "preco_usuario_adicional", "preco_veiculo_adicional",
  "ativo", "visivel_landing", "atualizado_em"
) VALUES
  ('PREVIEW', 0, 0, 0, 0, true, false, CURRENT_TIMESTAMP),
  ('ESSENCIAL', 450, 300, 25, 30, true, true, CURRENT_TIMESTAMP),
  ('AVANCADO', 650, 500, 25, 30, true, true, CURRENT_TIMESTAMP),
  ('ENTERPRISE', 1250, 1000, 25, 30, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("plano") DO NOTHING;

CREATE TABLE "solicitacoes_assinatura" (
  "id" TEXT NOT NULL,
  "tipo" "TipoSolicitacaoAssinatura" NOT NULL,
  "status" "StatusSolicitacaoAssinatura" NOT NULL DEFAULT 'PENDENTE',
  "plano_atual" "PlanoTipo" NOT NULL,
  "plano_solicitado" "PlanoTipo",
  "usuarios_adicionais_atuais" INTEGER NOT NULL,
  "usuarios_adicionais_solicitados" INTEGER NOT NULL,
  "veiculos_adicionais_atuais" INTEGER NOT NULL,
  "veiculos_adicionais_solicitados" INTEGER NOT NULL,
  "mensalidade_atual" DECIMAL(12,2) NOT NULL,
  "mensalidade_proposta" DECIMAL(12,2) NOT NULL,
  "catalogo_versao" INTEGER NOT NULL,
  "impacto" JSONB,
  "mensagem" TEXT,
  "resposta_admin" TEXT,
  "criado_por_nome" TEXT NOT NULL,
  "decidido_por_nome" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  "decidido_em" TIMESTAMP(3),
  "empresaId" TEXT NOT NULL,
  "criado_por_id" TEXT,
  "decidido_por_id" TEXT,
  "fatura_id" TEXT,
  CONSTRAINT "solicitacoes_assinatura_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "solicitacoes_assinatura_cotas_check" CHECK (
    "usuarios_adicionais_atuais" >= 0 AND
    "usuarios_adicionais_atuais" <= 10000 AND
    "usuarios_adicionais_solicitados" >= 0 AND
    "usuarios_adicionais_solicitados" <= 10000 AND
    "veiculos_adicionais_atuais" >= 0 AND
    "veiculos_adicionais_atuais" <= 100000 AND
    "veiculos_adicionais_solicitados" >= 0 AND
    "veiculos_adicionais_solicitados" <= 100000 AND
    "mensalidade_atual" >= 0 AND
    "mensalidade_proposta" >= 0
  ),
  CONSTRAINT "solicitacoes_assinatura_tipo_check" CHECK (
    ("tipo" = 'ALTERAR_PLANO' AND "plano_solicitado" IS NOT NULL AND "fatura_id" IS NULL) OR
    ("tipo" = 'ALTERAR_COTAS' AND "plano_solicitado" IS NULL AND "fatura_id" IS NULL) OR
    ("tipo" = 'NEGOCIAR_PAGAMENTO' AND "plano_solicitado" IS NULL AND "fatura_id" IS NOT NULL)
  )
);

ALTER TABLE "solicitacoes_assinatura"
  ADD CONSTRAINT "solicitacoes_assinatura_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_assinatura"
  ADD CONSTRAINT "solicitacoes_assinatura_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_assinatura"
  ADD CONSTRAINT "solicitacoes_assinatura_decidido_por_id_fkey"
  FOREIGN KEY ("decidido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_assinatura"
  ADD CONSTRAINT "solicitacoes_assinatura_fatura_id_fkey"
  FOREIGN KEY ("fatura_id") REFERENCES "faturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "solicitacoes_assinatura_empresaId_criado_em_idx"
  ON "solicitacoes_assinatura"("empresaId", "criado_em");
CREATE INDEX "solicitacoes_assinatura_status_criado_em_idx"
  ON "solicitacoes_assinatura"("status", "criado_em");
CREATE INDEX "solicitacoes_assinatura_fatura_id_idx"
  ON "solicitacoes_assinatura"("fatura_id");

-- Evita pedidos concorrentes do mesmo tipo para a mesma empresa.
CREATE UNIQUE INDEX "solicitacoes_assinatura_pendente_empresa_tipo_key"
  ON "solicitacoes_assinatura"("empresaId", "tipo")
  WHERE "status" = 'PENDENTE';

CREATE TRIGGER "auditar_planos_comerciais"
AFTER INSERT OR UPDATE OR DELETE ON "planos_comerciais"
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao();

CREATE TRIGGER "auditar_solicitacoes_assinatura"
AFTER INSERT OR UPDATE OR DELETE ON "solicitacoes_assinatura"
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao();

ALTER TABLE "planos_comerciais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitacoes_assinatura" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "planos_comerciais" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "solicitacoes_assinatura" FROM PUBLIC;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.planos_comerciais FROM %I', papel);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.solicitacoes_assinatura FROM %I', papel);
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE "planos_comerciais" IS
  'Condições comerciais editáveis exclusivamente pelo SuperAdmin; permissões técnicas permanecem no código.';
COMMENT ON TABLE "solicitacoes_assinatura" IS
  'Pedidos de plano, cotas e negociação calculados e decididos no servidor.';
