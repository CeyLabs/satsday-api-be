import type { Env, Task } from '../types'
import { jsonOk, jsonErr } from '../utils'

export async function getResult(req: Request, env: Env, taskId: string): Promise<Response> {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return jsonErr('missing_api_key', 401)

  const task = await env.DB.prepare(
    `SELECT * FROM tasks WHERE task_id = ? AND api_key = ?`
  ).bind(taskId, apiKey).first<Task>()

  if (!task) return jsonErr('task_not_found', 404)

  return jsonOk({
    task_id:    task.task_id,
    status:     task.status,
    solution:   task.solution ?? null,
    charged:    task.status === 'solved' ? task.cost_sats : 0,
    solved_at:  task.solved_at ?? null,
  })
}
