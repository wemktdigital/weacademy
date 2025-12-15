import { z } from 'zod'

export const pipelineApiKeySchema = z.object({
  pipeline_id: z.string().uuid('Pipeline ID deve ser um UUID válido'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  environment: z.enum(['production', 'test', 'development']).default('production'),
  enabled: z.boolean().default(true),
  rate_limit_per_minute: z.number().int().positive().default(60),
  rate_limit_per_hour: z.number().int().positive().default(1000),
  rate_limit_per_day: z.number().int().positive().default(10000),
  expires_at: z.string().datetime().optional(), // ISO datetime string
}).passthrough()

export type PipelineApiKey = z.infer<typeof pipelineApiKeySchema> & {
  id?: string
  user_id?: string
  api_key?: string
  key_prefix?: string
  last_used_at?: string
  usage_count?: number
  created_at?: string
  updated_at?: string
}

export type PipelineApiKeyFormData = z.infer<typeof pipelineApiKeySchema>

// Schema para métricas de uso
export const apiUsageMetricsSchema = z.object({
  api_key_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
})

export type ApiUsageMetrics = {
  total_requests: number
  successful_requests: number
  failed_requests: number
  total_cost_usd: number
  average_response_time_ms: number
  requests_by_status: Record<number, number>
  requests_over_time: Array<{ timestamp: string; count: number }>
}

