-- Mantém a origem comercial ligada ao tenant sem depender de um e-mail mutável.
ALTER TABLE public.solicitacoes_acesso
  ADD COLUMN empresa_id TEXT;

-- Solicitações aprovadas anteriores são ligadas pelo gestor originalmente criado
-- no mesmo fluxo. Contas e empresas já excluídas permanecem fora do vínculo.
UPDATE public.solicitacoes_acesso AS solicitacao
SET empresa_id = usuario."empresaId"
FROM public.usuarios AS usuario
JOIN public.empresas AS empresa ON empresa.id = usuario."empresaId"
WHERE solicitacao.status = 'APROVADO'
  AND solicitacao.email = usuario.email
  AND usuario.role = 'GESTOR_EMPRESA'
  AND usuario.excluido_em IS NULL
  AND empresa.excluido_em IS NULL;

-- Uma aprovação sem conta empresarial ativa é um resíduo de uma exclusão já
-- concluída. O trigger de auditoria conserva a ocorrência sem nome ou e-mail.
DELETE FROM public.solicitacoes_acesso
WHERE status = 'APROVADO'
  AND empresa_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    JOIN public.empresas AS empresa ON empresa.id = usuario."empresaId"
    WHERE usuario.email = solicitacoes_acesso.email
      AND usuario.excluido_em IS NULL
      AND empresa.excluido_em IS NULL
  );

CREATE UNIQUE INDEX solicitacoes_acesso_empresa_id_key
  ON public.solicitacoes_acesso(empresa_id);

ALTER TABLE public.solicitacoes_acesso
  ADD CONSTRAINT solicitacoes_acesso_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
