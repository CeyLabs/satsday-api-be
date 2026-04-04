import type { Env, Session, User } from './types'

/**
 * Verify Telegram login widget data using HMAC-SHA256.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export async function verifyTelegramAuth(
  data: Record<string, string>,
  botToken: string,
): Promise<boolean> {
  const { hash, ...fields } = data
  if (!hash) return false

  // Build check string: sorted key=value pairs joined by \n
  const checkStr = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // Secret key = SHA256 of bot token
  const encoder  = new TextEncoder()
  const keyData  = await crypto.subtle.digest('SHA-256', encoder.encode(botToken))
  const hmacKey  = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig      = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(checkStr))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

  // auth_date must be within 24h
  const authAge = Math.floor(Date.now() / 1000) - parseInt(data.auth_date || '0')
  if (authAge > 86400) return false

  return computed === hash
}

/**
 * Resolve session token from request → returns User or null.
 */
export async function resolveSession(req: Request, env: Env): Promise<User | null> {
  const token = req.headers.get('X-Session-Token')
  if (!token) return null

  const raw = await env.KV.get(`session:${token}`)
  if (!raw) return null

  const session: Session = JSON.parse(raw)

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE tg_user_id = ?'
  ).bind(session.tg_user_id).first<User>()

  return user ?? null
}
