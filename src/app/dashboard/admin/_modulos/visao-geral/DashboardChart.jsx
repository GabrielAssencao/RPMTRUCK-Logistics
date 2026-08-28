// src/app/admin/modules/dashboard/DashboardChart.jsx
'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

export default function DashboardChart({ data, selectedYear, onYearChange }) {
  const START_YEAR = 2026;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => START_YEAR + i);

  const total = data.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const media = data.length ? Math.round(total / data.length) : 0;

  const handlePrevYear = () => {
    const currentIndex = years.indexOf(selectedYear);
    if (currentIndex > 0) onYearChange(years[currentIndex - 1]);
  };

  const handleNextYear = () => {
    const currentIndex = years.indexOf(selectedYear);
    if (currentIndex < years.length - 1) onYearChange(years[currentIndex + 1]);
  };

  return (
    <div
      className="border p-6 flex flex-col justify-between rounded-2xl"
      style={{
        backgroundColor: 'var(--background-secondary)',
        borderColor: 'var(--border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] uppercase opacity-70">Crescimento</p>
          <h3 className="font-black text-sm tracking-widest mt-1">PLATAFORMA ({selectedYear})</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="border px-3 py-2 rounded-lg" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Total</p>
            <p className="font-black text-lg">{total}</p>
          </div>
          <div className="border px-3 py-2 rounded-lg" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Média</p>
            <p className="font-black text-lg">{media}</p>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" stroke="var(--foreground-muted)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis stroke="var(--foreground-muted)" tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              formatter={(value) => [`${value}`, 'Novos cadastros']}
              contentStyle={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--primary)"
              strokeWidth={3}
              fill="url(#growthFill)"
              activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--background)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={handlePrevYear}
          disabled={selectedYear === START_YEAR}
          className="p-1.5 border rounded-md transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border)' }}
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-center gap-2 max-w-xs overflow-x-auto py-1 font-mono text-xs font-bold">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => onYearChange(year)}
              className="px-3 py-1.5 border rounded-md font-black transition-all"
              style={{
                borderColor: selectedYear === year ? 'var(--primary)' : 'var(--border)',
                backgroundColor: selectedYear === year ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: selectedYear === year ? 'var(--primary)' : 'var(--foreground)',
              }}
            >
              {year}
            </button>
          ))}
        </div>

        <button
          onClick={handleNextYear}
          disabled={selectedYear === currentYear}
          className="p-1.5 border rounded-md transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border)' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}