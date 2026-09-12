ALTER TABLE "mensagens_suporte"
  ADD COLUMN "conteudo_original" TEXT,
  ADD COLUMN "editado_em" TIMESTAMP(3);

COMMENT ON COLUMN "mensagens_suporte"."conteudo_original" IS
  'Primeiro conteúdo enviado, preservado quando o autor edita a mensagem.';

COMMENT ON COLUMN "mensagens_suporte"."editado_em" IS
  'Data da edição mais recente feita pelo autor da mensagem.';
