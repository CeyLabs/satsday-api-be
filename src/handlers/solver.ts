import type { Env, Task } from '../types'
import { resolveSession } from '../auth'
import { jsonOk, jsonErr, randomId } from '../utils'

const PLATFORM_FEE_PCT = 0.15  // 15% platform cut

export async function getSolverTask(req: Request, env: Env): Promise<Response> {
  const user = await resolveSession(req, env)
  if (!user) return jsonErr('unauthorized', 401)

  // Check if user already has an assigned task
  const existing = await env.DB.prepare(`
    SELECT * FROM tasks
    WHERE assigned_to = ? AND status = 'assigned'
    ORDER BY created_at DESC LIMIT 1
  `).bind(user.tg_user_id).first<Task>()

  if (existing) return jsonOk(taskResponse(existing))

  // Dequeue next queued task
  const task = await env.DB.prepare(`
    SELECT * FROM tasks
    WHERE status = 'queued' AND assigned_to IS NULL
    ORDER BY created_at ASC LIMIT 1
  `).first<Task>()

  if (!task) return jsonOk({ status: 'empty' })

  // Assign it
  await env.DB.prepare(`
    UPDATE tasks SET status = 'assigned', assigned_to = ? WHERE task_id = ?
  `).bind(user.tg_user_id, task.task_id).run()

  task.assigned_to = user.tg_user_id
  task.status = 'assigned'

  return jsonOk(taskResponse(task))
}

export async function submitSolverTask(req: Request, env: Env): Promise<Response> {
  const user = await resolveSession(req, env)
  if (!user) return jsonErr('unauthorized', 401)

  const body = await req.json<{ task_id: string; solution: string }>()
  if (!body.task_id || !body.solution) return jsonErr('missing_fields', 400)

  const task = await env.DB.prepare(`
    SELECT * FROM tasks WHERE task_id = ? AND assigned_to = ? AND status = 'assigned'
  `).bind(body.task_id, user.tg_user_id).first<Task>()

  if (!task) return jsonErr('task_not_found', 404)

  // Verify solution (case-insensitive for text/image captchas)
  const correct = verifyAnswer(task, body.solution)
  const costSats = task.cost_sats ?? 75
  const solverEarns = Math.floor(costSats * (1 - PLATFORM_FEE_PCT))

  const now = Math.floor(Date.now() / 1000)

  if (correct) {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE tasks SET status='solved', solution=?, solved_at=? WHERE task_id=?
      `).bind(body.solution, now, task.task_id),
      env.DB.prepare(`
        UPDATE users SET
          balance_sats  = balance_sats + ?,
          solved_count  = solved_count + 1,
          correct_count = correct_count + 1,
          accuracy_pct  = CAST(correct_count + 1 AS REAL) / (solved_count + 1) * 100
        WHERE tg_user_id = ?
      `).bind(solverEarns, user.tg_user_id),
      env.DB.prepare(`
        UPDATE buyers SET balance_sats = balance_sats - ? WHERE api_key = ?
      `).bind(costSats, task.api_key),
      env.DB.prepare(`
        INSERT INTO ledger (task_id, buyer_debit, solver_credit, platform_fee)
        VALUES (?, ?, ?, ?)
      `).bind(task.task_id, costSats, solverEarns, costSats - solverEarns),
    ])

    // Refresh tier if accuracy >= 95%
    await updateTier(env, user.tg_user_id)

    return jsonOk({ correct: true, sats_earned: solverEarns })
  } else {
    // Wrong — update stats but no charge
    await env.DB.prepare(`
      UPDATE tasks SET status='failed', solution=?, solved_at=? WHERE task_id=?
    `).bind(body.solution, now, task.task_id)
    await env.DB.prepare(`
      UPDATE users SET
        solved_count = solved_count + 1,
        accuracy_pct = CAST(correct_count AS REAL) / (solved_count + 1) * 100
      WHERE tg_user_id = ?
    `).bind(user.tg_user_id).run()

    return jsonOk({ correct: false, sats_earned: 0 })
  }
}

export async function getSolverHistory(req: Request, env: Env): Promise<Response> {
  const user = await resolveSession(req, env)
  if (!user) return jsonErr('unauthorized', 401)

  const url   = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10'), 50)

  const { results } = await env.DB.prepare(`
    SELECT task_id, type, status, cost_sats, solved_at, created_at
    FROM tasks WHERE assigned_to = ?
    ORDER BY created_at DESC LIMIT ?
  `).bind(user.tg_user_id, limit).all()

  return jsonOk({ tasks: results })
}

function verifyAnswer(task: Task, answer: string): boolean {
  if (!task.solution) return false
  return task.solution.toUpperCase().trim() === answer.toUpperCase().trim()
}

function taskResponse(task: Task) {
  return {
    task_id:     task.task_id,
    type:        task.type,
    site_key:    task.site_key,
    site_url:    task.site_url,
    image_b64:   task.image_b64,
    image_url:   task.image_url,
    cost_sats:   task.cost_sats,
    timeout_secs: 30,
    status:      task.status,
  }
}

async function updateTier(env: Env, tgUserId: number) {
  const user = await env.DB.prepare(
    'SELECT accuracy_pct, solved_count FROM users WHERE tg_user_id = ?'
  ).bind(tgUserId).first<{ accuracy_pct: number; solved_count: number }>()
  if (!user) return
  const tier = user.solved_count >= 50 && user.accuracy_pct >= 95 ? 'premium' : 'standard'
  await env.DB.prepare('UPDATE users SET tier = ? WHERE tg_user_id = ?').bind(tier, tgUserId).run()
}
