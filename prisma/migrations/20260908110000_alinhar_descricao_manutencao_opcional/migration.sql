-- O formulário e o schema permitem manutenção sem descrição detalhada.
-- DROP NOT NULL é compatível com dados existentes e evita falha em novos cadastros.
ALTER TABLE "historicos_veiculo"
  ALTER COLUMN "descricao" DROP NOT NULL;
