import type { Env, BuyerTier, TaskType } from '../types'
import { jsonOk, jsonErr, randomId } from '../utils'

const COST_TABLE: Record<BuyerTier, Partial<Record<TaskType, number>> & { default: number }> = {
  starter:    { default: 75 },
  growth:     { default: 55, recaptcha: 75, hcaptcha: 75 },
  enterprise: { default: 35, recaptcha: 50, hcaptcha: 50 },
}

export async function submitTask(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const buyer = await env.DB.prepare(
    `SELECT * FROM buyers WHERE api_key = ?`
  ).bind(apiKey).first<{ api_key: string; balance_sats: number; tier: BuyerTier }>()

  if (!buyer) return jsonErr('invalid_api_key', 401)

  const body     = await req.json<{ type?: TaskType; image?: string; url?: string }>()
  const taskType = body.type ?? 'image'
  const tier     = buyer.tier as BuyerTier
  const cost     = COST_TABLE[tier][taskType] ?? COST_TABLE[tier].default

  if (buyer.balance_sats < cost) {
    return jsonErr('insufficient_balance', 402)
  }

  const taskId = `sd_${randomId(16)}`

  await env.DB.prepare(
    `INSERT INTO tasks (task_id, api_key, status, type, image_b64, image_url, cost_sats)
     VALUES (?, ?, 'queued', ?, ?, ?, ?)`
  ).bind(taskId, apiKey, taskType, body.image ?? null, body.url ?? null, cost).run()

  // Enqueue for bot dispatch
  await env.TASK_QUEUE.send({ task_id: taskId, type: taskType, cost_sats: cost })

  return jsonOk({
    task_id:    taskId,
    status:     'queued',
    cost_sats:  cost,
    est_secs:   25,
  })
}
