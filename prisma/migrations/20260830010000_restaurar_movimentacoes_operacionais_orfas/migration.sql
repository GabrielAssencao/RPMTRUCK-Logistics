-- Restaura movimentações que foram removidas da tabela operacional pelo fluxo
-- antigo, mas nunca foram exportadas nem purgadas. Os dados completos vêm do
-- log imutável de auditoria; nenhuma informação operacional é inventada.
WITH candidatos AS (
  SELECT
    permanente."container_origem_id",
    permanente."empresaId",
    auditoria.dados
  FROM "movimentacoes_container_permanentes" AS permanente
  JOIN LATERAL (
    SELECT CASE
      WHEN log."acao" = 'DELETE' THEN log."dados_anteriores"
      ELSE log."dados_novos"
    END AS dados
    FROM "auditoria_logs" AS log
    WHERE log."tabela" = 'containers'
      AND log."registro_id" = permanente."container_origem_id"
      AND CASE
        WHEN log."acao" = 'DELETE' THEN log."dados_anteriores" IS NOT NULL
        ELSE log."dados_novos" IS NOT NULL
      END
    ORDER BY log."criado_em" DESC
    LIMIT 1
  ) AS auditoria ON true
  WHERE permanente."registro_atual" = true
    AND permanente."relatorioArquivoId" IS NULL
    AND permanente."detalhes_purgados_em" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "containers" AS operacional
      WHERE operacional."id" = permanente."container_origem_id"
    )
), recuperaveis AS (
  SELECT candidato.*
  FROM candidatos AS candidato
  JOIN "empresas" AS empresa
    ON empresa."id" = candidato."empresaId"
  JOIN "veiculos" AS veiculo
    ON veiculo."id" = candidato.dados ->> 'veiculoId'
   AND veiculo."empresaId" = candidato."empresaId"
  WHERE candidato.dados ->> 'id' = candidato."container_origem_id"
    AND candidato.dados ->> 'empresaId' = candidato."empresaId"
    AND candidato.dados ?& ARRAY[
      'id', 'data', 'codigo', 'tipo', 'terminal_inicio', 'terminal_fim',
      'empresaId', 'veiculoId'
    ]
)
INSERT INTO "containers" (
  "id",
  "data",
  "codigo",
  "tipo",
  "terminal_inicio",
  "terminal_fim",
  "frete",
  "comissao",
  "percentual_comissao",
  "status",
  "observacoes",
  "itens_conteudo",
  "empresaId",
  "veiculoId",
  "motoristaId",
  "relatorioArquivoId",
  "criado_em",
  "atualizado_em"
)
SELECT
  recuperavel."container_origem_id",
  (recuperavel.dados ->> 'data')::timestamp,
  recuperavel.dados ->> 'codigo',
  recuperavel.dados ->> 'tipo',
  recuperavel.dados ->> 'terminal_inicio',
  recuperavel.dados ->> 'terminal_fim',
  COALESCE((recuperavel.dados ->> 'frete')::double precision, 0),
  COALESCE((recuperavel.dados ->> 'comissao')::double precision, 0),
  COALESCE((recuperavel.dados ->> 'percentual_comissao')::double precision, 10),
  COALESCE(recuperavel.dados ->> 'status', 'AGENDADO'),
  recuperavel.dados ->> 'observacoes',
  recuperavel.dados -> 'itens_conteudo',
  recuperavel."empresaId",
  recuperavel.dados ->> 'veiculoId',
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM "motoristas" AS motorista
      WHERE motorista."id" = recuperavel.dados ->> 'motoristaId'
        AND motorista."empresaId" = recuperavel."empresaId"
    ) THEN recuperavel.dados ->> 'motoristaId'
    ELSE NULL
  END,
  NULL,
  COALESCE((recuperavel.dados ->> 'criado_em')::timestamp, CURRENT_TIMESTAMP),
  COALESCE((recuperavel.dados ->> 'atualizado_em')::timestamp, CURRENT_TIMESTAMP)
FROM recuperaveis AS recuperavel
ON CONFLICT DO NOTHING;
