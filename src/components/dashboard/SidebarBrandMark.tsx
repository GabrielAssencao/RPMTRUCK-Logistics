import Image from 'next/image'
import { BrandLogo } from '@/components/brand/BrandLogo'

const ICON_HUE_ROTATIONS: Record<string, number> = {
  '#22c55e': 0,
  '#ef4444': -135,
  '#3b82f6': 80,
  '#f59e0b': -95,
  '#5e17eb': 125,
}

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
  const rotation = ICON_HUE_ROTATIONS[primary.toLowerCase()] ?? 0

  return (
    <span
      role="img"
      aria-label="RPMTRUCK"
      title="RPMTRUCK"
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border"
      style={{
        borderColor: 'color-mix(in srgb, var(--primary) 42%, var(--border))',
        backgroundColor: '#070707',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent)',
      }}
    >
      <Image
        src="/logos/RpmShieldIcon.svg"
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
        className="h-full w-full object-contain"
        style={{ filter: `hue-rotate(${rotation}deg)` }}
      />
    </span>
  )
}
