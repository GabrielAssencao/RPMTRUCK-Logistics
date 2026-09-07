// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'
import { JetBrains_Mono, Outfit, Rajdhani } from 'next/font/google'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RPMTruck Logistics | Gestão de Frota de Alta Performance',
  description: 'Plataforma completa de gerenciamento de caminhões, motoristas e custos operacionais.',
  keywords: ['gestão de frota', 'caminhões', 'logística', 'motoristas', 'custos operacionais'],
  icons: { icon: '/logos/logoRPMTRUCK_verde.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#22c55e',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A CSP usa nonce por requisição; páginas estáticas não possuem esse contexto.
  await connection()
  return (
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth" className={`${rajdhani.variable} ${outfit.variable} ${jetBrainsMono.variable}`}>
      <body className="antialiased overflow-x-hidden">
        
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
        {process.env.ENABLE_SPEED_INSIGHTS === 'true' && <SpeedInsights />}
      </body>
    </html>
  )
}
