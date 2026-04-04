import type { Env } from '../types'
import { jsonOk, jsonErr } from '../utils'

export async function getBalance(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const buyer = await env.DB.prepare(
    `SELECT balance_sats, tier FROM buyers WHERE api_key = ?`
  ).bind(apiKey).first<{ balance_sats: number; tier: string }>()

  if (!buyer) return jsonErr('invalid_api_key', 401)

  return jsonOk({ balance_sats: buyer.balance_sats, tier: buyer.tier })
}
