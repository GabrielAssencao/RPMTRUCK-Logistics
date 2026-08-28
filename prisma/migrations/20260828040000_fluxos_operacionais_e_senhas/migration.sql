-- Registra a data real da última definição de senha. Para contas existentes,
-- usa a última redefinição concluída quando houver e, em último caso, a criação.
ALTER TABLE "usuarios" ADD COLUMN "senha_alterada_em" TIMESTAMP(3);

UPDATE "usuarios" AS usuario
SET "senha_alterada_em" = COALESCE(
  (
    SELECT MAX(reset."token_usado_em")
    FROM "resets_senha" AS reset
    WHERE reset."email" = usuario."email"
  ),
  usuario."criado_em"
);

ALTER TABLE "usuarios"
  ALTER COLUMN "senha_alterada_em" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "senha_alterada_em" SET NOT NULL;

-- O histórico permanente passa a guardar revisões. A revisão corrente espelha
-- o registro operacional; uma revisão arquivada nunca é sobrescrita.
ALTER TABLE "movimentacoes_container_permanentes"
  ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "registro_atual" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "movimentacoes_container_permanentes_container_origem_id_key";

CREATE UNIQUE INDEX "mov_container_origem_versao_key"
ON "movimentacoes_container_permanentes"("container_origem_id", "versao");

CREATE UNIQUE INDEX "mov_container_registro_atual_key"
ON "movimentacoes_container_permanentes"("container_origem_id")
WHERE "registro_atual" = true;
