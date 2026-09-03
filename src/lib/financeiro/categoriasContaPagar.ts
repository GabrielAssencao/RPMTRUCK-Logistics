export const CATEGORIAS_CONTA_PAGAR = [
  {
    valor: 'COMBUSTIVEL',
    rotulo: 'Combustível',
    integracao: 'Custos & Despesas',
    requerVeiculo: true,
    descricoes: ['Abastecimento de combustível', 'Compra de Arla 32', 'Cartão combustível'],
  },
  {
    valor: 'MANUTENCAO',
    rotulo: 'Manutenção da frota',
    integracao: 'Manutenções + Custos & Despesas',
    requerVeiculo: true,
    descricoes: ['Manutenção preventiva', 'Manutenção corretiva', 'Peças e serviços de oficina'],
  },
  {
    valor: 'PEDAGIO',
    rotulo: 'Pedágios / tags',
    integracao: 'Custos & Despesas',
    requerVeiculo: true,
    descricoes: ['Fatura de pedágios', 'Recarga de tag de pedágio'],
  },
  {
    valor: 'ALIMENTACAO',
    rotulo: 'Alimentação',
    integracao: 'Custos & Despesas',
    requerVeiculo: false,
    descricoes: ['Alimentação de equipe', 'Reembolso de alimentação'],
  },
  {
    valor: 'DIARIA_MOTORISTA',
    rotulo: 'Diárias de motorista',
    integracao: 'Custos & Despesas',
    requerVeiculo: false,
    descricoes: ['Pagamento de diárias de motorista', 'Adiantamento de viagem'],
  },
  {
    valor: 'SEGURO',
    rotulo: 'Seguros / proteção',
    integracao: 'Custos & Despesas',
    requerVeiculo: false,
    descricoes: ['Seguro da frota', 'Seguro empresarial', 'Proteção veicular'],
  },
  {
    valor: 'SALARIO',
    rotulo: 'Salários / folha de pagamento',
    integracao: 'Custos & Despesas',
    requerVeiculo: false,
    descricoes: ['Pagamento de salário', 'Folha de pagamento', 'Encargos da folha de pagamento'],
  },
  {
    valor: 'COMISSAO_TRANSPORTE',
    rotulo: 'Comissão de transporte',
    integracao: 'Custos & Despesas',
    requerVeiculo: true,
    descricoes: ['Comissão de motorista', 'Comissão sobre frete', 'Pagamento de comissão de transporte'],
  },
  {
    valor: 'OUTROS',
    rotulo: 'Outras despesas',
    integracao: 'Custos & Despesas',
    requerVeiculo: false,
    descricoes: ['Impostos e taxas', 'Serviços de fornecedor', 'Aluguel e despesas administrativas'],
  },
] as const

export const VALORES_CATEGORIA_CONTA_PAGAR = CATEGORIAS_CONTA_PAGAR.map((categoria) => categoria.valor) as [
  (typeof CATEGORIAS_CONTA_PAGAR)[number]['valor'],
  ...(typeof CATEGORIAS_CONTA_PAGAR)[number]['valor'][],
]

export type CategoriaContaPagarValor = (typeof CATEGORIAS_CONTA_PAGAR)[number]['valor']

export function obterCategoriaContaPagar(valor: string | null | undefined) {
  return CATEGORIAS_CONTA_PAGAR.find((categoria) => categoria.valor === valor) ?? null
}

export function categoriaContaPagarRequerVeiculo(valor: string | null | undefined) {
  return obterCategoriaContaPagar(valor)?.requerVeiculo ?? false
}

export function descricaoContaPagarEhSugestao(descricao: string) {
  return CATEGORIAS_CONTA_PAGAR.some((categoria) => categoria.descricoes.some((sugestao) => sugestao === descricao))
}
