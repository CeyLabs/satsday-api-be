import type { Env } from '../types'
import { createInvoice } from '../lightning'
import { jsonOk, jsonErr, randomId } from '../utils'

const INITIAL_DEPOSIT_SATS = 5_000

export async function registerBuyer(req: Request, env: Env): Promise<Response> {
  const apiKey  = `sd_${randomId(24)}`
  const invoice = await createInvoice(env, INITIAL_DEPOSIT_SATS, `sats.day registration ${apiKey}`)

  await env.DB.prepare(
    `INSERT INTO buyers (api_key, balance_sats, tier) VALUES (?, 0, 'starter')`
  ).bind(apiKey).run()

  // Store pending invoice in KV with 1h TTL
  await env.KV.put(`invoice:${invoice.payment_hash}`, JSON.stringify({
    api_key: apiKey,
    sats: INITIAL_DEPOSIT_SATS,
    type: 'register',
  }), { expirationTtl: 3600 })

  return jsonOk({
    api_key: apiKey,
    invoice: invoice.bolt11,
    payment_hash: invoice.payment_hash,
    amount_sats: INITIAL_DEPOSIT_SATS,
    message: 'Pay this Lightning invoice to activate your account.',
  })
}
