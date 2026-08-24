import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

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
