-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN_RPM', 'GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "PlanoTipo" AS ENUM ('PREVIEW', 'ESSENCIAL', 'AVANCADO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "StatusEmpresa" AS ENUM ('ATIVO', 'INADIMPLENTE', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "StatusReset" AS ENUM ('PENDENTE', 'CONCLUIDO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('PENDENTE', 'PAGO');

-- CreateTable
CREATE TABLE "solicitacoes_acesso" (
    "id" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "veiculos" INTEGER NOT NULL,
    "plano" "PlanoTipo" NOT NULL,
    "mensagem" TEXT,
    "contatoPref" TEXT NOT NULL DEFAULT 'email',
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resets_senha" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "StatusReset" NOT NULL DEFAULT 'PENDENTE',
    "chave" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resets_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT NOT NULL,
    "nome_contato" TEXT,
    "status" "StatusEmpresa" NOT NULL DEFAULT 'ATIVO',
    "plano" "PlanoTipo" NOT NULL DEFAULT 'ESSENCIAL',
    "total_pago_historico" TEXT NOT NULL DEFAULT '0,00',
    "usuarios_adicionais" INTEGER NOT NULL DEFAULT 0,
    "veiculos_adicionais" INTEGER NOT NULL DEFAULT 0,
    "modulos" TEXT[] DEFAULT ARRAY['Módulo Frota']::TEXT[],
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GESTOR_EMPRESA',
    "empresaId" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historicos_veiculo" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "custo" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "km_atual" DOUBLE PRECISION NOT NULL,
    "proxima_revisao" TEXT,
    "veiculoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historicos_veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'PENDENTE',
    "comprovanteUrl" TEXT,
    "empresaId" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_acesso_email_key" ON "solicitacoes_acesso"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_email_key" ON "empresas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_veiculo" ADD CONSTRAINT "historicos_veiculo_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_veiculo" ADD CONSTRAINT "historicos_veiculo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
