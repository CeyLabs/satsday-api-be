import type { Env } from '../types'
import { resolveSession } from '../auth'
import { jsonOk, jsonErr } from '../utils'

const SATS_PER_BTC = 100_000_000

/**
 * Create a BTCPay Lightning invoice for solver or buyer deposit
 */
export async function createDeposit(req: Request, env: Env): Promise<Response> {
  const user = await resolveSession(req, env)
  if (!user) return jsonErr('unauthorized', 401)

  const body = await req.json<{ amount_sats: number }>()
  const sats = Math.max(1000, Math.min(body.amount_sats ?? 10_000, 10_000_000))

  // Create BTCPay invoice
  const invoice = await btcpayCreateInvoice(env, sats, {
    metadata: { tg_user_id: user.tg_user_id, type: 'solver_deposit' },
  })

  // Record pending payment
  await env.DB.prepare(`
    INSERT INTO payments (tg_user_id, btcpay_invoice_id, amount_sats, status, type)
    VALUES (?, ?, ?, 'pending', 'deposit')
  `).bind(user.tg_user_id, invoice.id, sats).run()

  return jsonOk({
    invoice_id:    invoice.id,
    btcpay_invoice_id: invoice.id,
    invoice:       invoice.bolt11,
    amount_sats:   sats,
    checkout_url:  invoice.checkoutLink,
  })
}

/**
 * Buyer deposit via API key (no session required)
 */
export async function createBuyerDeposit(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const buyer = await env.DB.prepare('SELECT * FROM buyers WHERE api_key = ?').bind(apiKey).first()
  if (!buyer) return jsonErr('invalid_api_key', 401)

  const body = await req.json<{ amount_sats: number }>()
  const sats = Math.max(1000, Math.min(body.amount_sats ?? 10_000, 10_000_000))

  const invoice = await btcpayCreateInvoice(env, sats, {
    metadata: { api_key: apiKey, type: 'buyer_deposit' },
  })

  await env.DB.prepare(`
    INSERT INTO payments (api_key, btcpay_invoice_id, amount_sats, status, type)
    VALUES (?, ?, ?, 'pending', 'deposit')
  `).bind(apiKey, invoice.id, sats).run()

  return jsonOk({
    invoice_id:    invoice.id,
    invoice:       invoice.bolt11,
    amount_sats:   sats,
    checkout_url:  invoice.checkoutLink,
  })
}

/**
 * Poll deposit status by invoice ID
 */
export async function getDepositStatus(req: Request, env: Env): Promise<Response> {
  const url       = new URL(req.url)
  const invoiceId = url.searchParams.get('invoice_id')
  if (!invoiceId) return jsonErr('missing_invoice_id', 400)

  const payment = await env.DB.prepare(
    'SELECT * FROM payments WHERE btcpay_invoice_id = ?'
  ).bind(invoiceId).first<{ status: string; amount_sats: number }>()

  if (!payment) return jsonErr('not_found', 404)
  return jsonOk({ status: payment.status, amount_sats: payment.amount_sats })
}

/**
 * BTCPay Server webhook — called when invoice is settled
 * Route: POST /btcpay/webhook
 * Must be configured in BTCPay: Store → Webhooks → Invoice Settled
 */
export async function btcpayWebhook(req: Request, env: Env): Promise<Response> {
  // Verify BTCPay signature
  const sig  = req.headers.get('BTCPay-Sig')
  const body = await req.text()

  if (!await verifyBtcpaySignature(body, sig, env.BTCPAY_API_KEY)) {
    return jsonErr('invalid_signature', 401)
  }

  const event = JSON.parse(body) as BTCPayWebhookEvent

  // Only process settled/complete invoices
  if (!['InvoiceSettled', 'InvoicePaymentSettled'].includes(event.type)) {
    return jsonOk({ ok: true })
  }

  const invoiceId = event.invoiceId
  const payment = await env.DB.prepare(
    'SELECT * FROM payments WHERE btcpay_invoice_id = ? AND status = ?'
  ).bind(invoiceId, 'pending').first<{
    tg_user_id?: number
    api_key?: string
    amount_sats: number
    type: string
  }>()

  if (!payment) return jsonOk({ ok: true })  // already processed

  const now = Math.floor(Date.now() / 1000)

  if (payment.tg_user_id) {
    // Solver deposit
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE users SET balance_sats = balance_sats + ? WHERE tg_user_id = ?
      `).bind(payment.amount_sats, payment.tg_user_id),
      env.DB.prepare(`
        UPDATE payments SET status = 'paid', settled_at = ? WHERE btcpay_invoice_id = ?
      `).bind(now, invoiceId),
    ])
  } else if (payment.api_key) {
    // Buyer deposit — also update tier
    const buyer = await env.DB.prepare(
      'SELECT balance_sats FROM buyers WHERE api_key = ?'
    ).bind(payment.api_key).first<{ balance_sats: number }>()

    const newBalance = (buyer?.balance_sats ?? 0) + payment.amount_sats
    const tier = newBalance >= 500_000 ? 'enterprise' : newBalance >= 50_000 ? 'growth' : 'starter'

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE buyers SET balance_sats = ?, tier = ? WHERE api_key = ?
      `).bind(newBalance, tier, payment.api_key),
      env.DB.prepare(`
        UPDATE payments SET status = 'paid', settled_at = ? WHERE btcpay_invoice_id = ?
      `).bind(now, invoiceId),
    ])
  }

  return jsonOk({ ok: true })
}

// ── BTCPay Server helpers ─────────────────────────────────

interface BTCPayInvoice {
  id:          string
  bolt11:      string
  checkoutLink: string
}

interface BTCPayWebhookEvent {
  type:       string
  invoiceId:  string
  storeId:    string
}

async function btcpayCreateInvoice(
  env: Env,
  sats: number,
  extra?: { metadata?: Record<string, unknown> },
): Promise<BTCPayInvoice> {
  const res = await fetch(
    `${env.BTCPAY_URL}/api/v1/stores/${env.BTCPAY_STORE_ID}/invoices`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `token ${env.BTCPAY_API_KEY}`,
      },
      body: JSON.stringify({
        amount:       (sats / SATS_PER_BTC).toFixed(8),
        currency:     'BTC',
        checkout:     { paymentMethods: ['BTC-LightningNetwork'] },
        metadata:     extra?.metadata ?? {},
      }),
    }
  )

  if (!res.ok) throw new Error('BTCPay invoice error: ' + res.status)

  const data = await res.json<{
    id: string
    checkoutLink: string
    bolt11?: string
    payments?: Array<{ destination: string }>
  }>()

  // Extract bolt11 from payment methods
  const bolt11 = data.bolt11 ?? data.payments?.[0]?.destination ?? ''

  return { id: data.id, bolt11, checkoutLink: data.checkoutLink }
}

async function verifyBtcpaySignature(
  body: string,
  sig: string | null,
  secret: string,
): Promise<boolean> {
  if (!sig) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const computed = 'sha256=' + Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === sig
}
