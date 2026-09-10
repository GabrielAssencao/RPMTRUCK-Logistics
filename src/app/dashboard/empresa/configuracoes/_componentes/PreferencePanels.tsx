'use client'

import Link from 'next/link'
import { BellRing, Check, Eye, EyeOff, Info, MonitorCog, ShieldAlert } from 'lucide-react'
import { CORES_E_LOGOS } from '@/data/temasELogos'
import DashboardEnvironmentBackground from '@/components/dashboard/DashboardEnvironmentBackground'
import { EMPRESA_NAVIGATION_ITEMS, type EstiloFundoEmpresa } from '@/lib/empresaPreferences'
import type { ModuloCodigo } from '@/utils/planos'

interface AppearancePreferencesProps {
  primary: string
  isLight: boolean
  backgroundStyle: EstiloFundoEmpresa
  onPrimaryChange: (color: string) => void
  onThemeChange: (isLight: boolean) => void
  onBackgroundStyleChange: (style: EstiloFundoEmpresa) => void
}

export function AppearancePreferences({
  primary,
  isLight,
  backgroundStyle,
  onPrimaryChange,
  onThemeChange,
  onBackgroundStyleChange,
}: AppearancePreferencesProps) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Modo de exibição" description="Escolha o contraste mais confortável para o ambiente de trabalho.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceButton active={!isLight} label="Modo escuro" description="Maior conforto em ambientes com pouca luz." onClick={() => onThemeChange(false)} primary={primary} />
          <ChoiceButton active={isLight} label="Modo claro" description="Mais contraste em ambientes iluminados." onClick={() => onThemeChange(true)} primary={primary} />
        </div>
      </SettingsSection>

      <SettingsSection title="Cor de destaque" description="A cor é aplicada à navegação, indicadores e identidade da empresa.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CORES_E_LOGOS.map((cor) => (
            <button
              type="button"
              key={cor.value}
              onClick={() => onPrimaryChange(cor.value)}
              aria-pressed={primary === cor.value}
              className="interactive-control flex min-h-12 items-center justify-between border px-3 text-left"
              style={{ borderColor: primary === cor.value ? cor.value : 'var(--border)', backgroundColor: primary === cor.value ? `${cor.value}12` : 'var(--background)' }}
            >
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <i className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ backgroundColor: cor.value }} aria-hidden="true" />
                {cor.label}
              </span>
              {primary === cor.value && <Check size={14} style={{ color: cor.value }} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Ambiente visual" description="Escolha um fundo decorativo para o dashboard ou mantenha a interface sólida.">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Fundo do dashboard">
          {([
            { value: 'DESLIGADO', label: 'Sem fundo', description: 'Interface sólida original.' },
            { value: 'DIGITAL', label: 'Malha digital', description: 'Luzes e grade em movimento.' },
            { value: 'TOPOGRAFICO', label: 'Topográfico', description: 'Curvas que se deformam e retornam em ciclo.' },
            { value: 'VIDRO_FLUIDO', label: 'Aurora de vidro', description: 'Lâminas luminosas em uma onda contínua.' },
            { value: 'VIDRO_CAMADAS', label: 'Vidro em camadas', description: 'Placas alinhadas que respiram em sequência.' },
            { value: 'ORGANICO', label: 'Traços orgânicos', description: 'Desenhos minimalistas que fluem e se misturam.' },
          ] as const).map((option) => {
            const active = backgroundStyle === option.value
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={option.value}
                onClick={() => onBackgroundStyleChange(option.value)}
                className="interactive-control border p-3 text-left"
                style={{ borderColor: active ? primary : 'var(--border)', backgroundColor: active ? `${primary}10` : 'var(--background)' }}
              >
                <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  {option.label}{active && <Check size={14} style={{ color: primary }} />}
                </span>
                <span className="mt-1 block text-[9px] leading-relaxed text-foreground-muted">{option.description}</span>
              </button>
            )
          })}
        </div>
        <div className={`dashboard-ambient-preview relative mt-4 h-36 overflow-hidden border ${backgroundStyle !== 'DESLIGADO' ? 'dashboard-environment-active' : ''}`} style={{ borderColor: backgroundStyle !== 'DESLIGADO' ? primary : 'var(--border)', backgroundColor: 'var(--background)' }}>
          <DashboardEnvironmentBackground estilo={backgroundStyle} preview />
          <div className="relative z-[1] grid h-full place-items-center p-5">
            <div className="border px-5 py-3 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-foreground-muted" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
              Prévia do ambiente
            </div>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-foreground-muted">
          <MonitorCog size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          O efeito de vidro só acompanha os fundos ativos. Em economia de energia ou movimento reduzido, as animações ficam estáticas.
        </p>
      </SettingsSection>
    </div>
  )
}

interface NavigationPreferencesProps {
  primary: string
  allowedModules: ModuloCodigo[]
  hiddenPaths: string[]
  onHiddenPathsChange: (paths: string[]) => void
}

export function NavigationPreferences({ primary, allowedModules, hiddenPaths, onHiddenPathsChange }: NavigationPreferencesProps) {
  const availableItems = EMPRESA_NAVIGATION_ITEMS.filter((item) => !item.modulo || allowedModules.includes(item.modulo))

  const setItemVisible = (path: string, visible: boolean) => {
    onHiddenPathsChange(visible
      ? hiddenPaths.filter((item) => item !== path)
      : Array.from(new Set([...hiddenPaths, path])))
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Módulos visíveis" description="Organize os atalhos da sidebar para destacar o que sua equipe usa com mais frequência.">
        <div className="mb-4 flex items-start gap-2 border p-3 text-[10px] leading-relaxed text-foreground-muted" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
          <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: primary }} aria-hidden="true" />
          Esta configuração é somente visual. Ela nunca libera funcionalidades fora do plano contratado nem modifica as permissões dos operadores.
        </div>
        <div className="divide-y border" style={{ borderColor: 'var(--border)' }}>
          {availableItems.map((item) => {
            const visible = !hiddenPaths.includes(item.path)
            return (
              <div key={item.path} className="flex items-center justify-between gap-4 p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wider">{item.label}</p>
                  <p className="mt-1 text-[9px] text-foreground-muted">{item.modulo ? `Módulo contratado: ${item.modulo.replaceAll('_', ' ')}` : 'Módulo essencial do sistema'}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={visible}
                  aria-label={`${visible ? 'Ocultar' : 'Exibir'} ${item.label} na sidebar`}
                  onClick={() => setItemVisible(item.path, !visible)}
                  className="interactive-control flex min-h-10 shrink-0 items-center gap-2 border px-3 text-[9px] font-bold uppercase tracking-wider"
                  style={{ borderColor: visible ? primary : 'var(--border)', color: visible ? primary : 'var(--foreground-muted)' }}
                >
                  {visible ? <Eye size={14} /> : <EyeOff size={14} />} {visible ? 'Visível' : 'Oculto'}
                </button>
              </div>
            )
          })}
        </div>
        {hiddenPaths.length > 0 && (
          <button type="button" onClick={() => onHiddenPathsChange([])} className="mt-4 min-h-10 border px-4 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: primary, color: primary }}>
            Restaurar todos os atalhos
          </button>
        )}
      </SettingsSection>
    </div>
  )
}

export function NotificationPreferences({ primary }: { primary: string }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Comunicações do sistema" description="Entenda quais avisos aparecem para a empresa e onde acompanhá-los.">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatusCard title="Alertas administrativos" description="Manutenção, mudanças de valor e comunicados enviados pelo superadmin." status="Sempre ativos" primary={primary} />
          <StatusCard title="Suporte e tickets" description="Respostas, mudanças de status e novas mensagens do atendimento." status="Ativo para gestores" primary={primary} />
        </div>
        <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-foreground-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Avisos críticos não podem ser ocultados, pois podem afetar disponibilidade, cobrança ou segurança da operação.
        </div>
      </SettingsSection>

      <Link href="/dashboard/empresa/notificacoes" className="interactive-control flex min-h-12 items-center justify-between border px-4 text-xs font-bold uppercase tracking-wider" style={{ borderColor: primary, color: primary }}>
        <span className="flex items-center gap-2"><BellRing size={16} /> Abrir central de notificações</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <div className="mb-5 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-foreground-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ChoiceButton({ active, label, description, onClick, primary }: { active: boolean; label: string; description: string; onClick: () => void; primary: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="interactive-control border p-4 text-left" style={{ borderColor: active ? primary : 'var(--border)', backgroundColor: active ? `${primary}10` : 'var(--background)' }}>
      <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">{label}{active && <Check size={15} style={{ color: primary }} />}</span>
      <span className="mt-1 block text-[9px] leading-relaxed text-foreground-muted">{description}</span>
    </button>
  )
}

function StatusCard({ title, description, status, primary }: { title: string; description: string; status: string; primary: string }) {
  return (
    <article className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
      <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
      <p className="mt-2 text-[10px] leading-relaxed text-foreground-muted">{description}</p>
      <span className="mt-3 inline-flex border px-2 py-1 text-[8px] font-black uppercase tracking-widest" style={{ borderColor: `${primary}66`, color: primary }}>{status}</span>
    </article>
  )
}
