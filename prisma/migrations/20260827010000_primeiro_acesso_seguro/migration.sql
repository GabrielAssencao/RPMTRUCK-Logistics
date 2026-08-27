ALTER TABLE "usuarios"
  ADD COLUMN "exige_troca_senha" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "senha_temporaria_expira_em" TIMESTAMP(3);
