// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

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
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
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
