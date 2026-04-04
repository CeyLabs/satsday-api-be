import type { Env } from './types'
import { registerBuyer } from './handlers/register'
import { submitTask }    from './handlers/submit'
import { getResult }     from './handlers/result'
import { getBalance }    from './handlers/balance'
import { depositInvoice } from './handlers/deposit'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
}

export class Router {
  constructor(private env: Env, private ctx: ExecutionContext) {}

  async handle(req: Request): Promise<Response> {
    const url    = new URL(req.url)
    const method = req.method

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    try {
      // POST /register  — create buyer, return invoice + api_key
      if (method === 'POST' && url.pathname === '/register') {
        return await registerBuyer(req, this.env)
      }

      // POST /deposit   — top up existing api_key balance
      if (method === 'POST' && url.pathname === '/deposit') {
        return await depositInvoice(req, this.env)
      }

      // POST /submit    — submit a CAPTCHA task
      if (method === 'POST' && url.pathname === '/submit') {
        return await submitTask(req, this.env)
      }

      // GET /result/:id — poll for solution
      const resultMatch = url.pathname.match(/^\/result\/([a-z0-9_]+)$/)
      if (method === 'GET' && resultMatch) {
        return await getResult(req, this.env, resultMatch[1])
      }

      // GET /balance    — check sats balance
      if (method === 'GET' && url.pathname === '/balance') {
        return await getBalance(req, this.env)
      }

      return this.json({ error: 'not_found' }, 404)
    } catch (err) {
      console.error(err)
      return this.json({ error: 'internal_error' }, 500)
    }
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
}
