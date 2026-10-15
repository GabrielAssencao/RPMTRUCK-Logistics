ALTER TYPE "TipoSolicitacaoAssinatura" ADD VALUE IF NOT EXISTS 'ALTERAR_VENCIMENTO';

COMMENT ON TYPE "TipoSolicitacaoAssinatura" IS
  'Mudancas comerciais solicitadas pela empresa e decididas pelo SuperAdmin; vencimento altera somente ciclos futuros.';
