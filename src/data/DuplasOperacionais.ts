// src/data/duplasOperacionais.ts
// ─────────────────────────────────────────────────────────────────────────
// Fonte única das "duplas" (Veículo + Motorista) usadas em Custos, Containers
// e futuramente em outros módulos. Hoje é um mock, mas futuramente será uma API REST.
// ─────────────────────────────────────────────────────────────────────────

export interface DuplaAlocada {
  id: string
  veiculoPlaca: string
  veiculoModelo: string
  motoristaNome: string
}

export const DUPLAS_OPERACIONAIS: DuplaAlocada[] = [
  { id: 'd1', veiculoPlaca: 'ABC-1234', veiculoModelo: 'VOLVO FH 540', motoristaNome: 'CARLOS SILVA' },
  { id: 'd2', veiculoPlaca: 'XYZ-9876', veiculoModelo: 'SCANIA R450', motoristaNome: 'JOÃO SANTOS' },
  { id: 'd3', veiculoPlaca: 'DEF-5678', veiculoModelo: 'MERCEDES ACTROS', motoristaNome: 'PEDRO FERNANDES' },
]

export function encontrarDupla(duplaId: string): DuplaAlocada | undefined {
  return DUPLAS_OPERACIONAIS.find(d => d.id === duplaId)
}
