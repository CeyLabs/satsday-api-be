import type { Env } from '../types'
import { createInvoice } from '../lightning'
import { jsonOk, jsonErr } from '../utils'

export async function depositInvoice(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const buyer = await env.DB.prepare(
    `SELECT api_key FROM buyers WHERE api_key = ?`
  ).bind(apiKey).first()
  if (!buyer) return jsonErr('invalid_api_key', 401)

  const body  = await req.json<{ amount_sats: number }>()
  const sats  = Math.max(1000, Math.min(body.amount_sats ?? 10_000, 10_000_000))
  const inv   = await createInvoice(env, sats, `sats.day deposit ${apiKey}`)

  await env.KV.put(`invoice:${inv.payment_hash}`, JSON.stringify({
    api_key: apiKey, sats, type: 'deposit',
  }), { expirationTtl: 3600 })

  return jsonOk({
    invoice:      inv.bolt11,
    payment_hash: inv.payment_hash,
    amount_sats:  sats,
  })
}
