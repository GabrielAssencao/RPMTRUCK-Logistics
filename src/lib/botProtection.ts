import 'server-only'

type TurnstileResponse = {
  success: boolean
  hostname?: string
  action?: string
  ['error-codes']?: string[]
}

const OFFICIAL_TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
])

export type BotVerification =
  | { success: true; skipped: boolean }
  | { success: false; reason: string }

export async function verifyBotToken({
  token,
  remoteIp,
  expectedAction,
}: {
  token?: string
  remoteIp?: string
  expectedAction: string
}): Promise<BotVerification> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  const required = process.env.TURNSTILE_REQUIRED === 'true'

  if (!secret) {
    return required
      ? { success: false, reason: 'BOT_PROTECTION_NOT_CONFIGURED' }
      : { success: true, skipped: true }
  }

  if (!token || token.length > 2048) {
    return { success: false, reason: 'MISSING_OR_INVALID_TOKEN' }
  }

  const officialTestMode = OFFICIAL_TEST_SECRET_KEYS.has(secret)
  if (officialTestMode && process.env.NODE_ENV === 'production') {
    return { success: false, reason: 'TEST_KEY_NOT_ALLOWED_IN_PRODUCTION' }
  }

  const form = new URLSearchParams({ secret, response: token })
  if (remoteIp && remoteIp !== 'unknown') form.set('remoteip', remoteIp)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    })
    if (!response.ok) return { success: false, reason: 'VERIFY_UNAVAILABLE' }

    const result = (await response.json()) as TurnstileResponse
    const allowedHosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)

    if (!result.success || (!officialTestMode && result.action !== expectedAction)) {
      return { success: false, reason: result['error-codes']?.join(',') || 'VERIFY_REJECTED' }
    }
    if (
      !officialTestMode
      && allowedHosts.length > 0
      && (!result.hostname || !allowedHosts.includes(result.hostname.toLowerCase()))
    ) {
      return { success: false, reason: 'HOSTNAME_REJECTED' }
    }

    return { success: true, skipped: false }
  } catch {
    return { success: false, reason: 'VERIFY_UNAVAILABLE' }
  }
}
