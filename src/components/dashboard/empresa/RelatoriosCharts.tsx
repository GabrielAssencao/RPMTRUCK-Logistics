'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface CustoVeiculo {
  veiculo: string
  combustivel: number
  manutencao: number
}

interface EficienciaMes {
  mes: string
  custoKm: number
  kmTotal: number
}

export function RelatorioCustoVeiculoChart({
  dados,
  corCombustivel,
  corManutencao,
}: {
  dados: CustoVeiculo[]
  corCombustivel: string
  corManutencao: string
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dados} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal vertical={false} />
        <XAxis type="number" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={valor => `R$${Number(valor) / 1000}k`} />
        <YAxis dataKey="veiculo" type="category" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} width={80} />
        <RechartsTooltip
          cursor={{ fill: 'var(--border)', opacity: 0.4 }}
          contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '12px', fontFamily: 'monospace' }}
          formatter={valor => [`R$ ${Number(valor).toLocaleString('pt-BR')}`, '']}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
        <Bar dataKey="combustivel" name="Combustível" stackId="a" fill={corCombustivel} radius={[0, 0, 0, 0]} />
        <Bar dataKey="manutencao" name="Manutenção" stackId="a" fill={corManutencao} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RelatorioEficienciaChart({
  dados,
  cor,
}: {
  dados: EficienciaMes[]
  cor: string
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dados} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="mes" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={valor => `R$${valor}`} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
        <RechartsTooltip
          contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '12px', fontFamily: 'monospace' }}
          formatter={valor => [`R$ ${Number(valor).toFixed(2)} / KM`, 'Custo Média']}
        />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
        <Line type="monotone" dataKey="custoKm" name="Custo Médio / KM (R$)" stroke={cor} strokeWidth={3} dot={{ r: 4, fill: 'var(--background)', stroke: cor, strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
