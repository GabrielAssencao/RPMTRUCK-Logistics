// src/lib/validation.ts
// Schemas Zod para validação de entrada em APIs
import { z } from 'zod';
import { MODULOS, PLANOS, STATUS_EMPRESA } from '@/utils/planos';

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * User creation schema
 */
export const criarUsuarioSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  email: z.string().email('Email inválido').toLowerCase().trim(),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(128),
  cargo: z.enum(['ADMIN_RPM', 'GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR']).optional().default('OPERADOR'),
  empresaId: z.string().uuid('ID da empresa inválido').optional(),
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

/**
 * Motorista creation schema
 */
export const criarMotoristaSchema = z.object({
  nomeAbreviado: z.string().min(3).max(100),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido'),
  cnh: z.string().min(11).max(11),
  categoria: z.enum(['A', 'B', 'C', 'D', 'E']),
  validadeCNH: z.string().datetime('Data de validade inválida'),
  empresaId: z.string().uuid(),
});

export type CriarMotoristaInput = z.infer<typeof criarMotoristaSchema>;

/**
 * Veiculo creation schema
 */
export const criarVeiculoSchema = z.object({
  modelo: z.string().min(3).max(100),
  placa: z.string().regex(/^[A-Z]{3}-?\d{4}$/, 'Placa inválida (ex: ABC-1234)'),
  tipo: z.enum(['Cavalo Mecânico', 'Bitrem', 'Sider', 'Baú', 'Tanque']),
  kmAtual: z.number().int().min(0),
  empresaId: z.string().uuid(),
});

export type CriarVeiculoInput = z.infer<typeof criarVeiculoSchema>;

/**
 * Empresa creation schema
 */
export const criarEmpresaSchema = z.object({
  nome: z.string().min(3).max(150),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
  email: z.string().email(),
  telefone: z.string().min(10).max(15),
  plano: z.enum(PLANOS),
  status: z.enum(STATUS_EMPRESA).optional().default('ATIVO'),
  nomeContato: z.string().max(100).optional(),
  modulos: z.array(z.enum(MODULOS)).optional(),
});

export type CriarEmpresaInput = z.infer<typeof criarEmpresaSchema>;

/**
 * Generic validator helper
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      };
    }
    return { success: false, error: 'Erro de validação desconhecido' };
  }
}
