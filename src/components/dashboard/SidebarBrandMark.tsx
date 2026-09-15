import { BrandLogo } from '@/components/brand/BrandLogo'

export function SidebarBrandIdentity({ primary }: { primary: string }) {
  return (
    <div role="img" className="flex h-full min-w-0 items-center w-full" aria-label="RPMTRUCK">
      <div
        className="flex h-[68px] w-full items-center justify-center rounded-md border px-4 py-2"
        style={{
          borderColor: 'color-mix(in srgb, var(--primary) 24%, var(--border))',
          backgroundColor: 'color-mix(in srgb, var(--primary) 8%, var(--background-secondary))',
        }}
      >
        <BrandLogo variant="wordmark" primary={primary} className="h-auto w-28 max-w-full shrink-0" />
      </div>
    </div>
  )
}

export default function SidebarBrandMark({ primary }: { primary: string }) {
  return <span role="img" aria-label="RPMTRUCK" title="RPMTRUCK" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'color-mix(in srgb, var(--primary) 24%, var(--border))', backgroundColor: 'color-mix(in srgb, var(--primary) 8%, var(--background-secondary))' }}><BrandLogo primary={primary} className="h-9 w-9" /></span>
}
