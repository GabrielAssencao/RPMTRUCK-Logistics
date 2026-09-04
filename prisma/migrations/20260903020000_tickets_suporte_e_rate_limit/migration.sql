-- Corrige a limpeza oportunista do rate limit. O nome `expira_em` também é uma
-- coluna de retorno da função e precisa estar qualificado dentro da subconsulta.
BEGIN;

CREATE OR REPLACE FUNCTION public.consumir_rate_limit(
    p_chave_hash TEXT,
    p_limite INTEGER,
    p_janela_ms INTEGER
)
RETURNS TABLE (
    permitido BOOLEAN,
    restante INTEGER,
    tentar_novamente INTEGER,
    expira_em TIMESTAMP(3)
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_agora TIMESTAMP(3) := clock_timestamp();
    v_contador INTEGER;
    v_expira_em TIMESTAMP(3);
BEGIN
    IF p_chave_hash IS NULL OR length(p_chave_hash) <> 64 THEN
        RAISE EXCEPTION 'Chave de rate limit inválida';
    END IF;
    IF p_limite < 1 OR p_janela_ms < 1000 THEN
        RAISE EXCEPTION 'Configuração de rate limit inválida';
    END IF;

    INSERT INTO public.rate_limits AS limite (
        chave_hash,
        contador,
        janela_inicio,
        expira_em,
        atualizado_em
    ) VALUES (
        p_chave_hash,
        1,
        v_agora,
        v_agora + (p_janela_ms * interval '1 millisecond'),
        v_agora
    )
    ON CONFLICT (chave_hash) DO UPDATE
    SET
        contador = CASE
            WHEN limite.expira_em <= v_agora THEN 1
            ELSE limite.contador + 1
        END,
        janela_inicio = CASE
            WHEN limite.expira_em <= v_agora THEN v_agora
            ELSE limite.janela_inicio
        END,
        expira_em = CASE
            WHEN limite.expira_em <= v_agora THEN v_agora + (p_janela_ms * interval '1 millisecond')
            ELSE limite.expira_em
        END,
        atualizado_em = v_agora
    RETURNING limite.contador, limite.expira_em
    INTO v_contador, v_expira_em;

    IF random() < 0.01 THEN
        DELETE FROM public.rate_limits AS expirado
        WHERE expirado.chave_hash IN (
            SELECT candidato.chave_hash
            FROM public.rate_limits AS candidato
            WHERE candidato.expira_em < v_agora - interval '1 day'
            LIMIT 500
        );
    END IF;

    permitido := v_contador <= p_limite;
    restante := GREATEST(p_limite - v_contador, 0);
    tentar_novamente := GREATEST(CEIL(EXTRACT(EPOCH FROM (v_expira_em - v_agora)))::INTEGER, 1);
    expira_em := v_expira_em;
    RETURN NEXT;
END;
$$;

CREATE TYPE "CategoriaTicketSuporte" AS ENUM (
  'SUPORTE_TECNICO',
  'REPORTAR_ERRO',
  'DUVIDA_OPERACIONAL',
  'SOLICITACAO',
  'FINANCEIRO'
);

CREATE TYPE "StatusTicketSuporte" AS ENUM (
  'ABERTO',
  'EM_ATENDIMENTO',
  'AGUARDANDO_CLIENTE',
  'RESOLVIDO',
  'FECHADO'
);

CREATE TYPE "PrioridadeTicketSuporte" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE');
CREATE TYPE "TipoMensagemSuporte" AS ENUM ('USUARIO', 'SISTEMA');

DROP INDEX IF EXISTS "conversas_suporte_empresaId_key";

ALTER TABLE "conversas_suporte"
  ADD COLUMN "protocolo" TEXT,
  ADD COLUMN "assunto" TEXT NOT NULL DEFAULT 'Atendimento anterior',
  ADD COLUMN "categoria" "CategoriaTicketSuporte" NOT NULL DEFAULT 'SUPORTE_TECNICO',
  ADD COLUMN "status" "StatusTicketSuporte" NOT NULL DEFAULT 'ABERTO',
  ADD COLUMN "prioridade" "PrioridadeTicketSuporte" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "cobravel_extra" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "franquia_no_momento" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ordem_na_competencia" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "competencia" DATE,
  ADD COLUMN "primeira_resposta_em" TIMESTAMP(3),
  ADD COLUMN "encerrado_em" TIMESTAMP(3);

UPDATE "conversas_suporte"
SET
  "protocolo" = 'SUP-LEG-' || upper(replace("id"::text, '-', '')),
  "competencia" = date_trunc('month', "criado_em")::date;

UPDATE "conversas_suporte" AS ticket
SET "franquia_no_momento" = CASE empresa."plano"
  WHEN 'ESSENCIAL' THEN 3
  WHEN 'AVANCADO' THEN 10
  WHEN 'ENTERPRISE' THEN 30
  WHEN 'PREVIEW' THEN 30
END
FROM "empresas" AS empresa
WHERE empresa."id" = ticket."empresaId";

UPDATE "conversas_suporte" AS ticket
SET "primeira_resposta_em" = resposta."respondido_em"
FROM (
  SELECT mensagem."conversaId", min(mensagem."criado_em") AS "respondido_em"
  FROM "mensagens_suporte" AS mensagem
  JOIN "usuarios" AS autor ON autor."id" = mensagem."autorId"
  WHERE autor."role" = 'ADMIN_RPM'
  GROUP BY mensagem."conversaId"
) AS resposta
WHERE resposta."conversaId" = ticket."id";

ALTER TABLE "conversas_suporte"
  ALTER COLUMN "protocolo" SET NOT NULL,
  ALTER COLUMN "protocolo" DROP DEFAULT,
  ALTER COLUMN "competencia" SET NOT NULL,
  ALTER COLUMN "competencia" DROP DEFAULT;

CREATE UNIQUE INDEX "conversas_suporte_protocolo_key" ON "conversas_suporte"("protocolo");
CREATE INDEX "conversas_suporte_empresaId_status_atualizado_em_idx"
  ON "conversas_suporte"("empresaId", "status", "atualizado_em");
CREATE INDEX "conversas_suporte_empresaId_competencia_idx"
  ON "conversas_suporte"("empresaId", "competencia");

ALTER TABLE "notificacoes"
  ADD COLUMN "ticketSuporteId" UUID;

ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_ticketSuporteId_fkey"
  FOREIGN KEY ("ticketSuporteId") REFERENCES "conversas_suporte"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "notificacoes_ticketSuporteId_usuarioId_lida_idx"
  ON "notificacoes"("ticketSuporteId", "usuarioId", "lida");

ALTER TABLE "conversas_suporte"
  ADD CONSTRAINT "conversas_suporte_assunto_check"
    CHECK (char_length(btrim("assunto")) BETWEEN 3 AND 160),
  ADD CONSTRAINT "conversas_suporte_franquia_check"
    CHECK ("franquia_no_momento" >= 0 AND "ordem_na_competencia" >= 1);

ALTER TABLE "mensagens_suporte"
  ADD COLUMN "tipo" "TipoMensagemSuporte" NOT NULL DEFAULT 'USUARIO',
  ADD COLUMN "automatica" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "autorId" DROP NOT NULL,
  DROP CONSTRAINT "mensagens_suporte_autorId_fkey",
  ADD CONSTRAINT "mensagens_suporte_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

REVOKE ALL ON TABLE "conversas_suporte", "mensagens_suporte" FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;

COMMIT;
