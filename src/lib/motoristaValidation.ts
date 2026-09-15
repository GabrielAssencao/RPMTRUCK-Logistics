import { z } from 'zod'
import { dataIsoSchema, nomePessoa } from '@/lib/domainValidation'
import { cpfValido } from '@/utils/documentos'

export const statusMotoristaSchema = z.enum(['DISPONIVEL', 'EM_ROTA', 'ALERTA', 'FERIAS'])
export const categoriaCnhSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'])

const camposCadastroMotorista = {
  nome: nomePessoa(3, 120),
  cpf: z.string().trim().regex(/^\d{11}$/, 'O CPF deve ter exatamente 11 números.').refine(cpfValido, 'Os dígitos verificadores do CPF não conferem.'),
  rg: z.string().trim().regex(/^[A-Z0-9]{7,14}$/, 'O RG/CIN deve ter de 7 a 14 letras ou números.').nullable(),
  cnh: z.string().trim().regex(/^\d{9,11}$/, 'Informe de 9 a 11 números do registro apresentado.'),
  categoria: categoriaCnhSchema,
  validade: dataIsoSchema,
  status: statusMotoristaSchema,
  veiculoId: z.string().uuid().nullable(),
}

export const cadastroMotoristaSchema = z.object({
  ...camposCadastroMotorista,
  status: statusMotoristaSchema.default('DISPONIVEL'),
}).strict()

export const atualizacaoMotoristaSchema = z.object({
  nome: camposCadastroMotorista.nome.optional(),
  cpf: camposCadastroMotorista.cpf.optional(),
  rg: camposCadastroMotorista.rg.optional(),
  cnh: camposCadastroMotorista.cnh.optional(),
  categoria: camposCadastroMotorista.categoria.optional(),
  validade: camposCadastroMotorista.validade.optional(),
  status: camposCadastroMotorista.status.optional(),
  veiculoId: camposCadastroMotorista.veiculoId.optional(),
}).strict().refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo para alterar.')
