-- Comprovantes mínimos permitem identificar uma exclusão sem conservar o nome,
-- e-mail ou documento da empresa removida.
ALTER TABLE public.exclusoes_empresa_jobs
  ADD COLUMN protocolo TEXT,
  ADD COLUMN resumo JSONB,
  ADD COLUMN politica_versao TEXT NOT NULL DEFAULT '2026-09',
  ADD COLUMN reter_ate TIMESTAMP(3);

UPDATE public.exclusoes_empresa_jobs
SET protocolo = 'EXC-LEG-' || upper(replace(id, '-', ''));

UPDATE public.exclusoes_empresa_jobs
SET reter_ate = COALESCE(concluido_em, atualizado_em) + INTERVAL '5 years'
WHERE status = 'CONCLUIDO';

ALTER TABLE public.exclusoes_empresa_jobs
  ALTER COLUMN protocolo SET NOT NULL;

CREATE UNIQUE INDEX exclusoes_empresa_jobs_protocolo_key
  ON public.exclusoes_empresa_jobs(protocolo);

CREATE INDEX exclusoes_empresa_jobs_status_reter_ate_idx
  ON public.exclusoes_empresa_jobs(status, reter_ate);

-- Os índices por data atendem a limpeza incremental sem varrer as tabelas inteiras.
CREATE INDEX auditoria_logs_criado_em_idx
  ON public.auditoria_logs(criado_em);

CREATE INDEX eventos_seguranca_criado_em_idx
  ON public.eventos_seguranca(criado_em);

-- A imutabilidade continua sendo a regra. A única exceção é uma transação de
-- retenção explicitamente marcada pelo processo interno e autenticado.
CREATE OR REPLACE FUNCTION public.rpm_bloquear_alteracao_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('rpm.retention_cleanup', true) = 'authorized' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Os registros de auditoria são imutáveis';
END;
$$;

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
    v_campos_sensiveis TEXT[] := ARRAY[
      'senha_hash', 'token_hash', 'chave',
      'cnpj', 'cnpj_hash', 'cpf', 'cpf_hash', 'rg', 'cnh', 'cnh_hash',
      'telefone', 'whatsapp'
    ];
BEGIN
    IF current_setting('rpm.retention_cleanup', true) = 'authorized' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'usuarios' THEN
        v_campos_sensiveis := v_campos_sensiveis || ARRAY['nome', 'email'];
    ELSIF TG_TABLE_NAME = 'empresas' THEN
        v_campos_sensiveis := v_campos_sensiveis || ARRAY['nome', 'email', 'nome_contato'];
    ELSIF TG_TABLE_NAME = 'solicitacoes_acesso' THEN
        v_campos_sensiveis := v_campos_sensiveis || ARRAY['responsavel', 'email'];
    ELSIF TG_TABLE_NAME = 'resets_senha' THEN
        v_campos_sensiveis := v_campos_sensiveis || ARRAY['email'];
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_anterior := to_jsonb(OLD) - v_campos_sensiveis;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_novo := to_jsonb(NEW) - v_campos_sensiveis;
    END IF;

    v_empresa_id := COALESCE(v_novo ->> 'empresaId', v_anterior ->> 'empresaId');
    IF TG_TABLE_NAME = 'empresas' THEN
        v_empresa_id := COALESCE(v_novo ->> 'id', v_anterior ->> 'id');
    END IF;

    v_usuario_id := NULLIF(current_setting('rpm.usuario_id', true), '');
    v_origem := COALESCE(NULLIF(current_setting('rpm.origem', true), ''), 'DATABASE');

    INSERT INTO public.auditoria_logs (
        tabela, acao, registro_id, empresa_id, usuario_id,
        dados_anteriores, dados_novos, origem
    ) VALUES (
        TG_TABLE_NAME, TG_OP,
        COALESCE(v_novo ->> 'id', v_anterior ->> 'id'),
        v_empresa_id, v_usuario_id, v_anterior, v_novo, v_origem
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpm_bloquear_alteracao_auditoria() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpm_auditar_mutacao() FROM PUBLIC;
