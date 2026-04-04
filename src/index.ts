/**
 * sats.day — API Worker
 * Cloudflare Workers + D1 + Queues + KV
 */

import { Router }    from './router'
import { handleQueue } from './queue'
import type { Env }  from './types'

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = new Router(env, ctx)
    return router.handle(req)
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await handleQueue(batch, env)
  },
}
