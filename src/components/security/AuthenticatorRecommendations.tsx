import { ExternalLink, Smartphone } from 'lucide-react'

const AUTHENTICATOR_APPS = [
  {
    name: 'Google Authenticator',
    href: 'https://support.google.com/accounts/answer/1066447?hl=pt',
  },
  {
    name: 'Microsoft Authenticator',
    href: 'https://support.microsoft.com/pt-br/authenticator/download-microsoft-authenticator',
  },
] as const

export function AuthenticatorRecommendations({ className = '' }: { className?: string }) {
  return (
    <aside className={`border border-border bg-background p-4 ${className}`.trim()} aria-labelledby="authenticator-apps-title">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 shrink-0 text-primary" size={17} aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <div>
            <h3 id="authenticator-apps-title" className="text-xs font-bold uppercase tracking-wide">Aplicativos recomendados</h3>
            <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
              Instale somente um deles pela página oficial. Os dois geram o código de seis dígitos usado pelo RPM Truck.
            </p>
          </div>
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {AUTHENTICATOR_APPS.map(app => (
              <li key={app.name}>
                <a
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 border border-border px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {app.name}
                  <ExternalLink size={13} aria-hidden="true" />
                  <span className="sr-only"> (abre a página oficial em uma nova guia)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
