import { z } from 'zod'

const CONTROLE_INSEGURO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
const TAG_HTML = /<\/?[a-z][^>]*>/i
const TEXTO_OPERACIONAL = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s.,;:!?()'"º°ª/+&@#$%_–—-]+$/
const NOME_PESSOA = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s.'-]*$/
const NOME_CURTO_OPERACIONAL = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9\s.,'º°ª/()&+_–—-]*$/

function semConteudoEstrutural(valor: string) {
  return !CONTROLE_INSEGURO.test(valor) && !TAG_HTML.test(valor)
}

export function textoOperacional(minimo: number, maximo: number) {
  return z.string()
    .trim()
    .min(minimo)
    .max(maximo)
    .regex(TEXTO_OPERACIONAL, 'Use somente texto, números e pontuação operacional comum.')
    .refine(semConteudoEstrutural, 'O texto contém marcação ou caracteres de controle não permitidos.')
}

export function nomeOperacional(minimo = 2, maximo = 160) {
  return z.string().trim().min(minimo).max(maximo)
    .regex(NOME_CURTO_OPERACIONAL, 'Informe um nome operacional válido.')
    .refine(semConteudoEstrutural, 'O nome contém marcação não permitida.')
}

export function nomePessoa(minimo = 3, maximo = 120) {
  return z.string().trim().min(minimo).max(maximo)
    .regex(NOME_PESSOA, 'Informe um nome de pessoa válido.')
    .refine(semConteudoEstrutural, 'O nome contém marcação não permitida.')
}

export const dataIsoSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use uma data válida no formato AAAA-MM-DD.')
  .refine((valor) => {
    const data = new Date(`${valor}T00:00:00Z`)
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
  }, 'Data inexistente.')

export const codigoContainerSchema = z.string()
  .trim()
  .transform((valor) => valor.toUpperCase().replace(/[\s-]/g, ''))
  .refine((valor) => /^[A-Z]{4}\d{7}$/.test(valor), 'Use o padrão ISO do container: quatro letras e sete números.')
  .transform((valor) => `${valor.slice(0, 4)} ${valor.slice(4, 10)}-${valor.slice(10)}`)

export const placaSchema = z.string()
  .trim()
  .transform((valor) => valor.toUpperCase().replace(/[\s-]/g, ''))
  .refine((valor) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(valor), 'Informe uma placa brasileira válida.')

export const valorMonetarioSchema = z.coerce.number().finite().min(0).max(1_000_000_000)
export const percentualSchema = z.coerce.number().finite().min(0).max(100)
export const quilometragemSchema = z.coerce.number().finite().min(0).max(100_000_000)

export function calcularComissao(frete: number, percentual: number) {
  return Math.round((frete * percentual / 100 + Number.EPSILON) * 100) / 100
}
