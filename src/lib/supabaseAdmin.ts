import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicPrivilegedKey = process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (publicPrivilegedKey) {
    throw new Error('SUPABASE_PRIVILEGED_KEY_MUST_NOT_BE_PUBLIC')
  }

  // A nova chave sb_secret_ é preferida. A variável legada permanece somente
  // como fallback durante uma migração sem indisponibilidade.
  const secretKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !secretKey) {
    throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED')
  }

  adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
