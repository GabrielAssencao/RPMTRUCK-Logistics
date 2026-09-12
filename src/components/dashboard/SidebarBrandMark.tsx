export function SidebarBrandIdentity({
  primary,
  subtitle,
}: {
  primary: string
  subtitle: string
}) {
  return (
    <div className="flex h-full min-w-0 items-center gap-2 px-2" aria-label={`RPMTRUCK · ${subtitle}`}>
      <SidebarBrandMark primary={primary} />
      <div className="min-w-0 leading-none">
        <div className="whitespace-nowrap text-xl font-black tracking-tight text-foreground">
          RPM<span style={{ color: primary }}>TRUCK</span>
        </div>
        <div className="mt-1.5 truncate text-[9px] font-bold uppercase tracking-[0.2em] text-foreground-muted">
          {subtitle}
        </div>
      </div>
    </div>
  )
}

export default function SidebarBrandMark({ primary }: { primary: string }) {
  return (
    <div
      role="img"
      aria-label="RPMTRUCK"
      title="RPMTRUCK"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border bg-black/20 font-rajdhani"
      style={{
        borderColor: 'var(--border-strong)',
        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
      }}
    >
      <span className="relative z-[1] text-[12px] font-black tracking-[-0.08em] text-foreground">
        RP<span style={{ color: primary }}>M</span>
      </span>
      <span className="absolute left-2 right-2 top-1.5 h-px" style={{ backgroundColor: primary }} aria-hidden="true" />
      <span className="absolute bottom-1.5 left-2 right-2 flex gap-0.5" aria-hidden="true">
        <i className="h-0.5 flex-[3]" style={{ backgroundColor: primary }} />
        <i className="h-0.5 flex-1" style={{ backgroundColor: primary }} />
        <i className="h-0.5 flex-1" style={{ backgroundColor: primary }} />
      </span>
    </div>
  )
}
