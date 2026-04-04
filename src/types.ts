export interface Env {
  DB:              D1Database
  KV:              KVNamespace
  TASK_QUEUE:      Queue
  LNBITS_BASE_URL: string
  LNBITS_API_KEY:  string
  ENVIRONMENT:     string
}

export type TaskStatus = 'queued' | 'assigned' | 'solved' | 'failed'
export type TaskType   = 'image' | 'text' | 'recaptcha' | 'hcaptcha'
export type BuyerTier  = 'starter' | 'growth' | 'enterprise'

export interface Task {
  task_id:     string
  api_key:     string
  status:      TaskStatus
  type:        TaskType
  image_url?:  string
  image_b64?:  string
  solution?:   string
  cost_sats?:  number
  assigned_to?: number
  created_at:  number
  solved_at?:  number
}

export interface Buyer {
  api_key:      string
  balance_sats: number
  tier:         BuyerTier
  webhook_url?: string
  created_at:   number
}

export interface Solver {
  tg_user_id:   number
  tg_username?: string
  balance_sats: number
  solved_count: number
  correct_count: number
  accuracy_pct: number
  tier:         'standard' | 'premium'
  active:       number
  registered_at: number
}
