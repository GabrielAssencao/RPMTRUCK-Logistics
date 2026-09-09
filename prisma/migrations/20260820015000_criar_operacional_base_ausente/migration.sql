-- Compatibilidade para bancos novos. Custos, localizações e a evolução do histórico
-- existiam no banco legado antes de o histórico de migrations ser consolidado.
DO $$
BEGIN
  CREATE TYPE "StatusManutencao" AS ENUM ('PENDENTE', 'CONCLUIDA', 'CANCELADA', 'NAO_REALIZADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CategoriaCusto" AS ENUM (
    'COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ALIMENTACAO',
    'DIARIA_MOTORISTA', 'SEGURO', 'OUTROS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StatusCusto" AS ENUM ('PAGO', 'PENDENTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "localizacoes" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cidadeUF" TEXT NOT NULL,
  "capacidade" INTEGER NOT NULL DEFAULT 0,
  "empresaId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "localizacoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "localizacoes_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "veiculos"
  ADD COLUMN IF NOT EXISTS "diasAntecedenciaNotif" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "localizacaoId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'veiculos_localizacaoId_fkey'
  ) THEN
    ALTER TABLE "veiculos"
      ADD CONSTRAINT "veiculos_localizacaoId_fkey"
      FOREIGN KEY ("localizacaoId") REFERENCES "localizacoes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'historicos_veiculo' AND column_name = 'data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'historicos_veiculo' AND column_name = 'data_agendada'
  ) THEN
    ALTER TABLE "historicos_veiculo" RENAME COLUMN "data" TO "data_agendada";
    ALTER TABLE "historicos_veiculo" ALTER COLUMN "atualizado_em" DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE "historicos_veiculo"
  ADD COLUMN IF NOT EXISTS "data_conclusao" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pecas_substituidas" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "StatusManutencao" NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS "origem" TEXT NOT NULL DEFAULT 'FUTURA';

CREATE TABLE IF NOT EXISTS "custos" (
  "id" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "ano" INTEGER NOT NULL,
  "mesIndex" INTEGER NOT NULL,
  "semanaIndex" INTEGER NOT NULL,
  "categoria" "CategoriaCusto" NOT NULL,
  "descricao" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "formaPagamento" TEXT NOT NULL DEFAULT 'CARTÃO CORPORATIVO',
  "status" "StatusCusto" NOT NULL DEFAULT 'PAGO',
  "veiculoId" TEXT NOT NULL,
  "motoristaId" TEXT,
  "empresaId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custos_veiculoId_fkey"
    FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custos_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "custos_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
