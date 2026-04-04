import type { Env } from '../types'
import { verifyTelegramAuth } from '../auth'
import { jsonOk, jsonErr, randomId } from '../utils'

export async function handleTelegramAuth(req: Request, env: Env): Promise<Response> {
  const body = await req.json<Record<string, string>>()

  const valid = await verifyTelegramAuth(body, env.TG_BOT_TOKEN)
  if (!valid) return jsonErr('invalid_telegram_auth', 401)

  const tgId = parseInt(body.id)

  // Upsert user
  await env.DB.prepare(`
    INSERT INTO users (tg_user_id, tg_username, tg_first_name, tg_hash)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tg_user_id) DO UPDATE SET
      tg_username   = excluded.tg_username,
      tg_first_name = excluded.tg_first_name,
      tg_hash       = excluded.tg_hash
  `).bind(tgId, body.username ?? null, body.first_name ?? null, body.hash).run()

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE tg_user_id = ?'
  ).bind(tgId).first()

  // Create session token — 30 day TTL
  const token = randomId(40)
  await env.KV.put(`session:${token}`, JSON.stringify({
    tg_user_id:    tgId,
    tg_username:   body.username,
    tg_first_name: body.first_name,
    created_at:    Math.floor(Date.now() / 1000),
  }), { expirationTtl: 60 * 60 * 24 * 30 })

  return jsonOk({ token, user })
}

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const token = req.headers.get('X-Session-Token')
  if (!token) return jsonErr('unauthorized', 401)

  const raw = await env.KV.get(`session:${token}`)
  if (!raw) return jsonErr('session_expired', 401)

  const session = JSON.parse(raw)
  const user = await env.DB.prepare(`
    SELECT tg_user_id, tg_username, tg_first_name, balance_sats,
           solved_count, correct_count, accuracy_pct, tier, registered_at,
           (SELECT COUNT(*) FROM tasks
            WHERE assigned_to = users.tg_user_id
              AND status = 'solved'
              AND solved_at >= unixepoch('now','start of day')) AS solved_today
    FROM users WHERE tg_user_id = ?
  `).bind(session.tg_user_id).first()

  if (!user) return jsonErr('user_not_found', 404)
  return jsonOk(user)
}
