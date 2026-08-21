-- Rate limit persistente e atômico. A chave armazenada é um HMAC, nunca o IP/e-mail em texto puro.
CREATE TABLE "rate_limits" (
    "chave_hash" TEXT NOT NULL,
    "contador" INTEGER NOT NULL,
    "janela_inicio" TIMESTAMP(3) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("chave_hash"),
    CONSTRAINT "rate_limits_contador_check" CHECK ("contador" >= 0)
);

CREATE INDEX "rate_limits_expira_em_idx" ON "rate_limits"("expira_em");

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

    -- Limpeza oportunista mantém a tabela pequena sem depender de cron no plano Free.
    IF random() < 0.01 THEN
        DELETE FROM public.rate_limits
        WHERE chave_hash IN (
            SELECT chave_hash
            FROM public.rate_limits
            WHERE expira_em < v_agora - interval '1 day'
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

-- Auditoria imutável. Não há FKs para preservar os identificadores mesmo após exclusões.
CREATE TABLE "auditoria_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tabela" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "registro_id" TEXT,
    "empresa_id" TEXT,
    "usuario_id" TEXT,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "origem" TEXT NOT NULL DEFAULT 'DATABASE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auditoria_logs_acao_check" CHECK ("acao" IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX "auditoria_logs_empresa_id_criado_em_idx"
    ON "auditoria_logs"("empresa_id", "criado_em");
CREATE INDEX "auditoria_logs_tabela_registro_id_criado_em_idx"
    ON "auditoria_logs"("tabela", "registro_id", "criado_em");
CREATE INDEX "auditoria_logs_usuario_id_criado_em_idx"
    ON "auditoria_logs"("usuario_id", "criado_em");

CREATE OR REPLACE FUNCTION public.rpm_auditar_mutacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_anterior JSONB;
    v_novo JSONB;
    v_empresa_id TEXT;
    v_usuario_id TEXT;
    v_origem TEXT;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_anterior := to_jsonb(OLD) - ARRAY['senha_hash', 'token_hash', 'chave'];
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_novo := to_jsonb(NEW) - ARRAY['senha_hash', 'token_hash', 'chave'];
    END IF;

    v_empresa_id := COALESCE(v_novo ->> 'empresaId', v_anterior ->> 'empresaId');
    IF TG_TABLE_NAME = 'empresas' THEN
        v_empresa_id := COALESCE(v_novo ->> 'id', v_anterior ->> 'id');
    END IF;

    v_usuario_id := NULLIF(current_setting('rpm.usuario_id', true), '');
    v_origem := COALESCE(NULLIF(current_setting('rpm.origem', true), ''), 'DATABASE');

    INSERT INTO public.auditoria_logs (
        tabela,
        acao,
        registro_id,
        empresa_id,
        usuario_id,
        dados_anteriores,
        dados_novos,
        origem
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(v_novo ->> 'id', v_anterior ->> 'id'),
        v_empresa_id,
        v_usuario_id,
        v_anterior,
        v_novo,
        v_origem
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpm_bloquear_alteracao_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Os registros de auditoria são imutáveis';
END;
$$;

CREATE TRIGGER "auditoria_logs_imutaveis"
BEFORE UPDATE OR DELETE ON "auditoria_logs"
FOR EACH ROW EXECUTE FUNCTION public.rpm_bloquear_alteracao_auditoria();

DO $$
DECLARE
    tabela_auditada TEXT;
BEGIN
    FOREACH tabela_auditada IN ARRAY ARRAY[
        'solicitacoes_acesso',
        'resets_senha',
        'empresas',
        'usuarios',
        'localizacoes',
        'veiculos',
        'motoristas',
        'historicos_veiculo',
        'leituras_quilometragem',
        'custos',
        'tarefas',
        'containers',
        'movimentacoes_container_permanentes',
        'faturas',
        'relatorios_arquivados'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao()',
            'auditar_' || tabela_auditada,
            tabela_auditada
        );
    END LOOP;
END;
$$;

-- A aplicação usa JWT próprio. O acesso direto via SDK Supabase fica fechado;
-- toda autorização multi-tenant acontece nas APIs e consultas Prisma do servidor.
DO $$
DECLARE
    tabela_protegida TEXT;
    papel TEXT;
BEGIN
    FOREACH tabela_protegida IN ARRAY ARRAY[
        'solicitacoes_acesso',
        'resets_senha',
        'empresas',
        'usuarios',
        'localizacoes',
        'veiculos',
        'motoristas',
        'historicos_veiculo',
        'leituras_quilometragem',
        'custos',
        'notificacoes',
        'tarefas',
        'containers',
        'movimentacoes_container_permanentes',
        'faturas',
        'relatorios_arquivados',
        'rate_limits',
        'auditoria_logs'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela_protegida);

        FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
                EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', tabela_protegida, papel);
            END IF;
        END LOOP;
    END LOOP;

    FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER) FROM %I', papel);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rpm_auditar_mutacao() FROM %I', papel);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rpm_bloquear_alteracao_auditoria() FROM %I', papel);
        END IF;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpm_auditar_mutacao() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpm_bloquear_alteracao_auditoria() FROM PUBLIC;
REVOKE UPDATE, DELETE ON TABLE public.auditoria_logs FROM PUBLIC;
