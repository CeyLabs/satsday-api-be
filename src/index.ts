import { Router }    from './router'
import type { Env }  from './types'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return new Router(env).handle(req)
  },
}
