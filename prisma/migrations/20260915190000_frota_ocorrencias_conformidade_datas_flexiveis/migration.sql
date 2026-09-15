CREATE TYPE "TipoOcorrenciaVeiculo" AS ENUM ('MULTA', 'COLISAO', 'AVARIA', 'OUTRA');
CREATE TYPE "StatusOcorrenciaVeiculo" AS ENUM ('ABERTA', 'EM_ANALISE', 'RESOLVIDA');
CREATE TYPE "TipoConformidadeMotorista" AS ENUM ('CURSO', 'EXAME_TOXICOLOGICO');

ALTER TABLE public.veiculos ADD COLUMN renavam TEXT;
ALTER TABLE public.tarefas ADD COLUMN dia_inteiro BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.lembretes_pessoais ADD COLUMN dia_inteiro BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.custos ADD COLUMN ocorrencia_veiculo_id TEXT;

CREATE TABLE public.ocorrencias_veiculos (
  id TEXT NOT NULL,
  tipo "TipoOcorrenciaVeiculo" NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  local TEXT,
  valor DECIMAL(12,2),
  pontos_cnh INTEGER,
  status "StatusOcorrenciaVeiculo" NOT NULL DEFAULT 'ABERTA',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP(3) NOT NULL,
  "empresaId" TEXT NOT NULL,
  "veiculoId" TEXT NOT NULL,
  "motoristaId" TEXT,
  conta_pagar_id TEXT,
  criado_por_id TEXT,
  CONSTRAINT ocorrencias_veiculos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.conformidades_motoristas (
  id TEXT NOT NULL,
  tipo "TipoConformidadeMotorista" NOT NULL,
  nome TEXT NOT NULL,
  numero TEXT,
  emitido_em DATE,
  validade DATE,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  carga_aplicavel TEXT,
  veiculo_aplicavel TEXT,
  observacoes TEXT,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP(3) NOT NULL,
  "empresaId" TEXT NOT NULL,
  "motoristaId" TEXT NOT NULL,
  criado_por_id TEXT,
  CONSTRAINT conformidades_motoristas_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX veiculos_renavam_key ON public.veiculos(renavam);
CREATE UNIQUE INDEX ocorrencias_veiculos_conta_pagar_id_key ON public.ocorrencias_veiculos(conta_pagar_id);
CREATE UNIQUE INDEX custos_ocorrencia_veiculo_id_key ON public.custos(ocorrencia_veiculo_id);
CREATE INDEX ocorrencias_veiculos_empresaId_data_idx ON public.ocorrencias_veiculos("empresaId", data);
CREATE INDEX ocorrencias_veiculos_empresaId_status_data_idx ON public.ocorrencias_veiculos("empresaId", status, data);
CREATE INDEX ocorrencias_veiculos_veiculoId_data_idx ON public.ocorrencias_veiculos("veiculoId", data);
CREATE INDEX ocorrencias_veiculos_motoristaId_data_idx ON public.ocorrencias_veiculos("motoristaId", data);
CREATE INDEX conformidades_motoristas_empresaId_motoristaId_validade_idx ON public.conformidades_motoristas("empresaId", "motoristaId", validade);
CREATE INDEX conformidades_motoristas_empresaId_tipo_validade_idx ON public.conformidades_motoristas("empresaId", tipo, validade);

ALTER TABLE public.ocorrencias_veiculos ADD CONSTRAINT ocorrencias_veiculos_empresaId_fkey FOREIGN KEY ("empresaId") REFERENCES public.empresas(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.ocorrencias_veiculos ADD CONSTRAINT ocorrencias_veiculos_veiculoId_fkey FOREIGN KEY ("veiculoId") REFERENCES public.veiculos(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public.ocorrencias_veiculos ADD CONSTRAINT ocorrencias_veiculos_motoristaId_fkey FOREIGN KEY ("motoristaId") REFERENCES public.motoristas(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.ocorrencias_veiculos ADD CONSTRAINT ocorrencias_veiculos_conta_pagar_id_fkey FOREIGN KEY (conta_pagar_id) REFERENCES public.contas_pagar(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.ocorrencias_veiculos ADD CONSTRAINT ocorrencias_veiculos_criado_por_id_fkey FOREIGN KEY (criado_por_id) REFERENCES public.usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.conformidades_motoristas ADD CONSTRAINT conformidades_motoristas_empresaId_fkey FOREIGN KEY ("empresaId") REFERENCES public.empresas(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.conformidades_motoristas ADD CONSTRAINT conformidades_motoristas_motoristaId_fkey FOREIGN KEY ("motoristaId") REFERENCES public.motoristas(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.conformidades_motoristas ADD CONSTRAINT conformidades_motoristas_criado_por_id_fkey FOREIGN KEY (criado_por_id) REFERENCES public.usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.custos ADD CONSTRAINT custos_ocorrencia_veiculo_id_fkey FOREIGN KEY (ocorrencia_veiculo_id) REFERENCES public.ocorrencias_veiculos(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.ocorrencias_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conformidades_motoristas ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.ocorrencias_veiculos FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.conformidades_motoristas FROM anon, authenticated;

CREATE TRIGGER auditar_ocorrencias_veiculos
AFTER INSERT OR UPDATE OR DELETE ON public.ocorrencias_veiculos
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao();

CREATE TRIGGER auditar_conformidades_motoristas
AFTER INSERT OR UPDATE OR DELETE ON public.conformidades_motoristas
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao();

ALTER TABLE public.ocorrencias_veiculos
  ADD CONSTRAINT ocorrencias_pontos_cnh_check CHECK (pontos_cnh IS NULL OR pontos_cnh BETWEEN 0 AND 20),
  ADD CONSTRAINT ocorrencias_valor_check CHECK (valor IS NULL OR valor >= 0);
