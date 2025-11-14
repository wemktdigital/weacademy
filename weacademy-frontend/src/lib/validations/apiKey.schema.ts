import { z } from 'zod'

export const apiKeySchema = z.object({
  pipeline_id: z.string().uuid('Pipeline ID deve ser um UUID válido'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  rate_limit_per_minute: z.number().int().positive().max(1000).optional().default(60),
  rate_limit_per_hour: z.number().int().positive().max(100000).optional().default(1000),
  rate_limit_per_day: z.number().int().positive().max(1000000).optional().default(10000),
  expires_at: z.string().datetime().optional(), // ISO datetime string
}).passthrough()

export type ApiKey = z.infer<typeof apiKeySchema> & {
  id?: string
  user_id?: string
  api_key?: string // Apenas na criação
  key_hash?: string
  prefix?: string
  enabled?: boolean
  last_used_at?: string
  total_requests?: number
  created_at?: string
  updated_at?: string
}

export type ApiKeyFormData = z.infer<typeof apiKeySchema>

// Schema para uso de API
export const apiUsageSchema = z.object({
  api_key_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  request_method: z.string(),
  request_path: z.string(),
  response_status: z.number().int(),
  response_time_ms: z.number().int().optional(),
  tokens_used: z.number().int().optional(),
  cost_usd: z.number().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
})

export type ApiUsage = z.infer<typeof apiUsageSchema> & {
  id?: string
  created_at?: string
}

