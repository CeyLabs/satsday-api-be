import type { Env } from './types'

/**
 * Queue consumer — forwards tasks to the Telegram bot via KV signal.
 * The bot polls KV for new assignments and acks them back.
 */
export async function handleQueue(
  batch: MessageBatch<unknown>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const task = msg.body as { task_id: string; type: string; cost_sats: number }

    // Find an available solver (highest accuracy, currently active)
    const solver = await env.DB.prepare(
      `SELECT tg_user_id FROM solvers
       WHERE active = 1
       ORDER BY accuracy_pct DESC, balance_sats ASC
       LIMIT 1`
    ).first<{ tg_user_id: number }>()

    if (!solver) {
      // No solvers available — retry later
      msg.retry()
      continue
    }

    // Assign task to solver
    await env.DB.prepare(
      `UPDATE tasks SET status = 'assigned', assigned_to = ? WHERE task_id = ?`
    ).bind(solver.tg_user_id, task.task_id).run()

    // Signal bot via KV (bot polls this)
    await env.KV.put(
      `bot:task:${solver.tg_user_id}`,
      JSON.stringify({ task_id: task.task_id, type: task.type, cost_sats: task.cost_sats }),
      { expirationTtl: 60 }
    )

    msg.ack()
  }
}
