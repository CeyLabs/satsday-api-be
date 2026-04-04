export interface Env {
  DB:              D1Database
  KV:              KVNamespace
  TASK_QUEUE:      Queue
  TG_BOT_TOKEN:    string
  BTCPAY_URL:      string
  BTCPAY_API_KEY:  string
  BTCPAY_STORE_ID: string
  FRONTEND_URL:    string
  ENVIRONMENT:     string
}

export type TaskStatus  = 'queued' | 'assigned' | 'solved' | 'failed'
export type TaskType    = 'image' | 'text' | 'recaptcha' | 'hcaptcha'
export type BuyerTier   = 'starter' | 'growth' | 'enterprise'
export type SolverTier  = 'standard' | 'premium'

export interface User {
  tg_user_id:   number
  tg_username?: string
  tg_first_name?: string
  balance_sats: number
  solved_count: number
  correct_count: number
  accuracy_pct: number
  tier:         SolverTier
  active:       number
  registered_at: number
}

export interface Task {
  task_id:     string
  api_key:     string
  status:      TaskStatus
  type:        TaskType
  site_url?:   string
  site_key?:   string
  image_b64?:  string
  image_url?:  string
  solution?:   string
  cost_sats?:  number
  assigned_to?: number
  created_at:  number
  solved_at?:  number
}

export interface Session {
  tg_user_id:   number
  tg_username?: string
  tg_first_name?: string
  created_at:   number
}
