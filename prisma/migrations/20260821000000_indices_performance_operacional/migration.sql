CREATE INDEX IF NOT EXISTS "solicitacoes_acesso_status_criado_em_idx"
ON "solicitacoes_acesso"("status", "criado_em");

CREATE INDEX IF NOT EXISTS "usuarios_empresaId_role_idx"
ON "usuarios"("empresaId", "role");

CREATE INDEX IF NOT EXISTS "localizacoes_empresaId_nome_idx"
ON "localizacoes"("empresaId", "nome");

CREATE INDEX IF NOT EXISTS "veiculos_empresaId_status_idx"
ON "veiculos"("empresaId", "status");

CREATE INDEX IF NOT EXISTS "motoristas_empresaId_validade_idx"
ON "motoristas"("empresaId", "validade");

CREATE INDEX IF NOT EXISTS "historicos_veiculo_empresaId_status_data_agendada_idx"
ON "historicos_veiculo"("empresaId", "status", "data_agendada");

CREATE INDEX IF NOT EXISTS "historicos_veiculo_empresaId_data_agendada_idx"
ON "historicos_veiculo"("empresaId", "data_agendada");

CREATE INDEX IF NOT EXISTS "historicos_veiculo_veiculoId_data_agendada_idx"
ON "historicos_veiculo"("veiculoId", "data_agendada");

CREATE INDEX IF NOT EXISTS "custos_empresaId_data_idx"
ON "custos"("empresaId", "data");

CREATE INDEX IF NOT EXISTS "custos_veiculoId_data_idx"
ON "custos"("veiculoId", "data");

CREATE INDEX IF NOT EXISTS "faturas_empresaId_criado_em_idx"
ON "faturas"("empresaId", "criado_em");

CREATE INDEX IF NOT EXISTS "faturas_status_criado_em_idx"
ON "faturas"("status", "criado_em");
