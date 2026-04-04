import type { Env } from '../types'
import { jsonOk, jsonErr, randomId } from '../utils'
import { resolveSession } from '../auth'

const COST_TABLE = {
  starter:    { default: 75 },
  growth:     { default: 55, recaptcha: 75, hcaptcha: 75 },
  enterprise: { default: 35, recaptcha: 50, hcaptcha: 50 },
} as const

export async function registerBuyer(req: Request, env: Env): Promise<Response> {
  // Optional: link to TG session if provided
  const session  = await resolveSession(req, env)
  const apiKey   = `sd_${randomId(24)}`

  await env.DB.prepare(`
    INSERT INTO buyers (api_key, tg_user_id, balance_sats, tier)
    VALUES (?, ?, 0, 'starter')
  `).bind(apiKey, session?.tg_user_id ?? null).run()

  return jsonOk({
    api_key: apiKey,
    message: 'Use POST /deposit to top up via Lightning. Balance unlocks API access.',
  })
}

export async function submitTask(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const buyer = await env.DB.prepare(
    'SELECT * FROM buyers WHERE api_key = ?'
  ).bind(apiKey).first<{ api_key: string; balance_sats: number; tier: string }>()
  if (!buyer) return jsonErr('invalid_api_key', 401)

  const body    = await req.json<{ type?: string; image?: string; url?: string; site_key?: string; site_url?: string }>()
  const type    = body.type ?? 'image'
  const tier    = buyer.tier as keyof typeof COST_TABLE
  const costs   = COST_TABLE[tier] ?? COST_TABLE.starter
  const cost    = (costs as Record<string, number>)[type] ?? costs.default

  if (buyer.balance_sats < cost) return jsonErr('insufficient_balance', 402)

  const taskId  = `sd_${randomId(16)}`
  await env.DB.prepare(`
    INSERT INTO tasks (task_id, api_key, type, image_b64, image_url, site_key, site_url, cost_sats)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(taskId, apiKey, type, body.image ?? null, body.url ?? null,
          body.site_key ?? null, body.site_url ?? null, cost).run()

  await env.TASK_QUEUE.send({ task_id: taskId, type, cost_sats: cost })

  return jsonOk({ task_id: taskId, status: 'queued', cost_sats: cost, est_secs: 25 })
}

export async function getResult(req: Request, env: Env, taskId: string): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const task = await env.DB.prepare(
    'SELECT * FROM tasks WHERE task_id = ? AND api_key = ?'
  ).bind(taskId, apiKey).first<{ status: string; solution: string | null; cost_sats: number; solved_at: number | null }>()
  if (!task) return jsonErr('not_found', 404)

  return jsonOk({
    task_id:  taskId,
    status:   task.status,
    solution: task.solution ?? null,
    charged:  task.status === 'solved' ? task.cost_sats : 0,
    solved_at: task.solved_at,
  })
}

export async function getBalance(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const buyer = await env.DB.prepare(
    'SELECT balance_sats, tier FROM buyers WHERE api_key = ?'
  ).bind(apiKey).first()
  if (!buyer) return jsonErr('invalid_api_key', 401)

  return jsonOk(buyer)
}
