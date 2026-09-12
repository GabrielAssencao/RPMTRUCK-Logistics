WITH contagem_automatica AS (
  SELECT
    "conversaId",
    COUNT(*)::INTEGER AS total
  FROM "mensagens_suporte"
  WHERE "automatica" = TRUE
    AND "visibilidade" = 'TODOS'
  GROUP BY "conversaId"
)
UPDATE "conversas_suporte" AS conversa
SET "etapa_triagem" = GREATEST(1, LEAST(4, contagem.total))
FROM contagem_automatica AS contagem
WHERE conversa."id" = contagem."conversaId";

UPDATE "conversas_suporte"
SET "triagem_concluida_em" = COALESCE("triagem_concluida_em", "atualizado_em")
WHERE "status" <> 'ABERTO'
   OR "etapa_triagem" >= 4;
