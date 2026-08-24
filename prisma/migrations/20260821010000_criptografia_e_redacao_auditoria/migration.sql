-- Colunas de busca determinística para campos criptografados com nonce aleatório.
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnpj_hash TEXT;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS cpf_hash TEXT;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS cnh_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_hash_key ON public.empresas(cnpj_hash);
CREATE UNIQUE INDEX IF NOT EXISTS motoristas_empresa_id_cpf_hash_key ON public.motoristas("empresaId", cpf_hash);
CREATE UNIQUE INDEX IF NOT EXISTS motoristas_empresa_id_cnh_hash_key ON public.motoristas("empresaId", cnh_hash);

-- Dados pessoais e credenciais não pertencem ao snapshot imutável de auditoria.
-- Usuário, tabela, ação, registro, tenant e data continuam preservados.
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

-- Saneamento único dos snapshots antigos. A trava é restaurada na mesma transação da migration.
ALTER TABLE public.auditoria_logs DISABLE TRIGGER auditoria_logs_imutaveis;
UPDATE public.auditoria_logs
SET
  dados_anteriores = dados_anteriores - ARRAY[
    'senha_hash', 'token_hash', 'chave', 'cnpj', 'cnpj_hash',
    'cpf', 'cpf_hash', 'rg', 'cnh', 'cnh_hash', 'telefone', 'whatsapp'
  ],
  dados_novos = dados_novos - ARRAY[
    'senha_hash', 'token_hash', 'chave', 'cnpj', 'cnpj_hash',
    'cpf', 'cpf_hash', 'rg', 'cnh', 'cnh_hash', 'telefone', 'whatsapp'
  ];
ALTER TABLE public.auditoria_logs ENABLE TRIGGER auditoria_logs_imutaveis;

REVOKE EXECUTE ON FUNCTION public.rpm_auditar_mutacao() FROM PUBLIC;
