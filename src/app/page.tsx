// src/app/page.tsx
// FIX: Sem 'use client' aqui — layout server-side é mais estável.
// Os componentes individuais já têm 'use client' onde precisam.

import Navbar    from '@/components/landing/Navbar'
import Hero      from '@/components/landing/Hero'
import Ticker    from '@/components/landing/Ticker'
import Features  from '@/components/landing/Features'
import Stats     from '@/components/landing/Stats'
import Plans     from '@/components/landing/Plans'
import CTA       from '@/components/landing/CTA'
import Footer    from '@/components/landing/Footer'
import { LandingStatsProvider } from '@/contexts/LandingStatsContext'

export default function LandingPage() {
  return (
    <>
      
      <Navbar />

      
      <Hero>
        <LandingStatsProvider>
          <Ticker />
          <Features />
          <Stats />
          <Plans />
          <CTA />
          <Footer />
        </LandingStatsProvider>
      </Hero>
    </>
  )
}
