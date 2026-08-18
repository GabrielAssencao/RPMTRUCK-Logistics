import { createBrowserClient } from '@supabase/ssr'

// Cria o client do Supabase para uso no browser (componentes client-side)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
