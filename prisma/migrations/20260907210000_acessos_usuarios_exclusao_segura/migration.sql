-- Permissões individuais sempre representam um subconjunto dos módulos da empresa.
-- A migração preserva o comportamento dos usuários existentes concedendo os
-- módulos que a empresa já possuía no momento da implantação.
ALTER TABLE public.usuarios
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "modulos_acesso" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "excluido_em" TIMESTAMP(3);

ALTER TABLE public.empresas
  ADD COLUMN "excluido_em" TIMESTAMP(3);

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_modulos_acesso_validos_check
  CHECK ("modulos_acesso" <@ ARRAY[
    'FROTA', 'GESTAO', 'CONTAS_PAGAR', 'NOTIFICACOES', 'TAREFAS', 'RELATORIOS'
  ]::TEXT[]);

CREATE INDEX usuarios_empresa_id_ativo_excluido_em_idx
  ON public.usuarios("empresaId", "ativo", "excluido_em");

CREATE INDEX empresas_excluido_em_idx
  ON public.empresas("excluido_em");

-- Nome e e-mail não devem ser copiados para novos snapshots imutáveis. A trilha
-- conserva tabela, ação, identificadores pseudônimos, tenant e data do evento.
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
    -- Campos como "nome" tambem existem em entidades operacionais. A remocao
    -- adicional e limitada somente as tabelas que armazenam dados pessoais.
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

REVOKE EXECUTE ON FUNCTION public.rpm_auditar_mutacao() FROM PUBLIC;

-- Remove PII dos snapshots antigos sem apagar a trilha imutável.
ALTER TABLE public.auditoria_logs DISABLE TRIGGER auditoria_logs_imutaveis;
UPDATE public.auditoria_logs
SET
  dados_anteriores = dados_anteriores - ARRAY['nome', 'email'],
  dados_novos = dados_novos - ARRAY['nome', 'email']
WHERE tabela = 'usuarios';

UPDATE public.auditoria_logs
SET
  dados_anteriores = dados_anteriores - ARRAY['nome', 'email', 'nome_contato'],
  dados_novos = dados_novos - ARRAY['nome', 'email', 'nome_contato']
WHERE tabela = 'empresas';

UPDATE public.auditoria_logs
SET
  dados_anteriores = dados_anteriores - ARRAY['responsavel', 'email'],
  dados_novos = dados_novos - ARRAY['responsavel', 'email']
WHERE tabela = 'solicitacoes_acesso';

UPDATE public.auditoria_logs
SET
  dados_anteriores = dados_anteriores - ARRAY['email'],
  dados_novos = dados_novos - ARRAY['email']
WHERE tabela = 'resets_senha';
ALTER TABLE public.auditoria_logs ENABLE TRIGGER auditoria_logs_imutaveis;

UPDATE public.usuarios AS usuario
SET "modulos_acesso" = empresa."modulos"
FROM public.empresas AS empresa
WHERE usuario."empresaId" = empresa.id
  AND usuario.role IN ('OPERADOR', 'VISUALIZADOR');
