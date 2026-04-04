import type { Env } from './types'

interface LNBitsInvoice {
  payment_hash: string
  bolt11:       string
}

/**
 * Create a BOLT11 receive invoice via LNbits
 */
export async function createInvoice(env: Env, sats: number, memo: string): Promise<LNBitsInvoice> {
  const res = await fetch(`${env.LNBITS_BASE_URL}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key':    env.LNBITS_API_KEY,
    },
    body: JSON.stringify({ out: false, amount: sats, memo }),
  })

  if (!res.ok) {
    throw new Error(`LNbits invoice error: ${res.status}`)
  }

  return res.json<LNBitsInvoice>()
}

/**
 * Pay a BOLT11 invoice via LNbits (solver withdrawals)
 */
export async function payInvoice(env: Env, bolt11: string): Promise<void> {
  const res = await fetch(`${env.LNBITS_BASE_URL}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key':    env.LNBITS_API_KEY,
    },
    body: JSON.stringify({ out: true, bolt11 }),
  })

  if (!res.ok) {
    throw new Error(`LNbits pay error: ${res.status}`)
  }
}
