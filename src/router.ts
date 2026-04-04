import type { Env } from './types'
import { corsHeaders, jsonErr } from './utils'
import { handleTelegramAuth, handleMe }    from './handlers/auth'
import { registerBuyer, submitTask, getResult, getBalance } from './handlers/register'
import { getSolverTask, submitSolverTask, getSolverHistory } from './handlers/solver'
import { createDeposit, createBuyerDeposit, getDepositStatus, btcpayWebhook } from './handlers/btcpay'

export class Router {
  constructor(private env: Env) {}

  async handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return corsHeaders()

    const url  = new URL(req.url)
    const path = url.pathname
    const m    = req.method

    try {
      // ── Auth ──────────────────────────────────────────
      if (m === 'POST' && path === '/auth/telegram')    return handleTelegramAuth(req, this.env)
      if (m === 'GET'  && path === '/me')               return handleMe(req, this.env)

      // ── Solver (session auth) ─────────────────────────
      if (m === 'GET'  && path === '/solver/task')      return getSolverTask(req, this.env)
      if (m === 'POST' && path === '/solver/solve')     return submitSolverTask(req, this.env)
      if (m === 'GET'  && path === '/solver/history')   return getSolverHistory(req, this.env)

      // ── Solver deposit ────────────────────────────────
      if (m === 'POST' && path === '/deposit')          return createDeposit(req, this.env)
      if (m === 'GET'  && path === '/deposit/status')   return getDepositStatus(req, this.env)

      // ── BTCPay webhook ────────────────────────────────
      if (m === 'POST' && path === '/btcpay/webhook')   return btcpayWebhook(req, this.env)

      // ── Buyer API (api key auth) ───────────────────────
      if (m === 'POST' && path === '/register')         return registerBuyer(req, this.env)
      if (m === 'POST' && path === '/submit')           return submitTask(req, this.env)
      if (m === 'POST' && path === '/buyer/deposit')    return createBuyerDeposit(req, this.env)
      if (m === 'GET'  && path === '/balance')          return getBalance(req, this.env)
      const resultMatch = path.match(/^\/result\/([a-z0-9_]+)$/)
      if (m === 'GET'  && resultMatch)                  return getResult(req, this.env, resultMatch[1])

      return jsonErr('not_found', 404)
    } catch (err) {
      console.error('[Router]', err)
      return jsonErr('internal_error', 500)
    }
  }
}
