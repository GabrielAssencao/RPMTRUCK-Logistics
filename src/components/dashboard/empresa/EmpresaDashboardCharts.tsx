'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface SerieCusto {
  dia: string
  combustivel: number
  manutencao: number
  pedagio: number
}

interface DistribuicaoCusto {
  name: string
  value: number
}

export function DashboardCostAreaChart({
  dados,
  corCombustivel,
  corManutencao,
  corPedagio,
}: {
  dados: SerieCusto[]
  corCombustivel: string
  corManutencao: string
  corPedagio: string
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={dados} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="dia" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={valor => `R$${Number(valor) / 1000}k`} />
        <RechartsTooltip
          contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '12px' }}
          formatter={valor => [`R$ ${Number(valor).toLocaleString('pt-BR')}`, '']}
        />
        <Area type="monotone" dataKey="combustivel" stroke={corCombustivel} strokeWidth={2} fillOpacity={0.2} fill={corCombustivel} name="Combustível" />
        <Area type="monotone" dataKey="manutencao" stroke={corManutencao} strokeWidth={2} fillOpacity={0.2} fill={corManutencao} name="Manutenção" />
        <Area type="monotone" dataKey="pedagio" stroke={corPedagio} strokeWidth={2} fillOpacity={0.2} fill={corPedagio} name="Pedágio" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DashboardDistributionPieChart({
  dados,
  cores,
}: {
  dados: DistribuicaoCusto[]
  cores: readonly string[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={dados}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={88}
          paddingAngle={4}
          dataKey="value"
          stroke="var(--background-secondary)"
          strokeWidth={3}
          startAngle={90}
          endAngle={-270}
        >
          {dados.map((entry, index) => (
            <Cell key={entry.name} fill={cores[index] ?? 'var(--border)'} />
          ))}
        </Pie>
        <RechartsTooltip
          contentStyle={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
            fontSize: '12px',
            borderRadius: '12px',
          }}
          formatter={valor => [`${Number(valor)}%`, 'Proporção']}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
