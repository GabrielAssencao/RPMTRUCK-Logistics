/*
  Warnings:

  - Added the required column `atualizado_em` to the `veiculos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "veiculos" ADD COLUMN     "ano" INTEGER,
ADD COLUMN     "atualizado_em" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dias_notificacao" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "localizacao" TEXT,
ADD COLUMN     "notificar_manutencao" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "proxima_manutencao" TIMESTAMP(3),
ADD COLUMN     "quilometragem" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPERACIONAL',
ADD COLUMN     "ultima_manutencao" TIMESTAMP(3);
