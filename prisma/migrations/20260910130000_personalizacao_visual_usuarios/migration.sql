ALTER TABLE "usuarios"
ADD COLUMN "cor_tema" VARCHAR(16),
ADD COLUMN "tema_claro" BOOLEAN,
ADD COLUMN "rotulo_equipe" VARCHAR(48),
ADD COLUMN "pode_personalizar_tema" BOOLEAN NOT NULL DEFAULT false;
