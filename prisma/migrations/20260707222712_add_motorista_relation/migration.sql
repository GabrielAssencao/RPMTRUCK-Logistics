-- CreateTable
CREATE TABLE "motoristas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnh" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "validade" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "empresaId" TEXT NOT NULL,
    "veiculoId" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
