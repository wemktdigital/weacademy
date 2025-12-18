import { z } from 'zod'

// Schema para configuração de cron
export const cronConfigSchema = z.object({
  cron: z.string().regex(
    /^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    'Formato de cron inválido. Use: minuto hora dia mês dia-semana'
  ),
}).passthrough()

// Schema para configuração de interval
export const intervalConfigSchema = z.object({
  interval: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM (opcional, usado para daily/weekly/monthly)
  dayOfWeek: z.number().int().min(0).max(6).optional(), // 0 = domingo, 6 = sábado (usado para weekly)
  dayOfMonth: z.number().int().min(1).max(31).optional(), // 1-31 (usado para monthly)
}).passthrough()

// Schema para configuração de webhook
export const webhookConfigSchema = z.object({
  webhook_path: z.string().min(1).regex(/^\/[a-z0-9\-/]+$/i, 'Path deve começar com / e conter apenas letras, números e hífens'),
}).passthrough()

// Schema para configuração de evento
export const eventConfigSchema = z.object({
  event_type: z.string().min(1), // ex: "user.created", "course.enrolled", etc.
  filters: z.record(z.string(), z.any()).optional(), // Filtros adicionais para o evento
}).passthrough()

// Schema union para schedule_config
export const scheduleConfigSchema = z.union([
  cronConfigSchema,
  intervalConfigSchema,
  webhookConfigSchema,
  eventConfigSchema,
])

// Schema principal de agendamento
export const pipelineScheduleSchema = z.object({
  pipeline_id: z.string().uuid('Pipeline ID deve ser um UUID válido'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  schedule_type: z.enum(['cron', 'interval', 'webhook', 'event']),
  schedule_config: scheduleConfigSchema,
  input_data: z.record(z.string(), z.any()).optional(), // Dados de input para o pipeline
  enabled: z.boolean().default(true),
}).passthrough()

export type PipelineSchedule = z.infer<typeof pipelineScheduleSchema> & {
  id?: string
  user_id?: string
  last_run_at?: string
  next_run_at?: string
  created_at?: string
  updated_at?: string
}

export type PipelineScheduleFormData = z.infer<typeof pipelineScheduleSchema>

// Schema para resposta de execução agendada
export const scheduleRunSchema = z.object({
  id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  started_at: z.string(),
  completed_at: z.string().optional(),
  duration_ms: z.number().optional(),
  input_messages: z.any().optional(),
  output_messages: z.any().optional(),
  total_cost_usd: z.number().optional(),
  error_message: z.string().optional(),
  trigger_type: z.enum(['schedule', 'webhook', 'event']).optional(),
  trigger_data: z.any().optional(),
  created_at: z.string(),
})

export type ScheduleRun = z.infer<typeof scheduleRunSchema>

// Schema para webhook
export const webhookSchema = z.object({
  schedule_id: z.string().uuid(),
  webhook_path: z.string(),
  secret_token: z.string().optional(),
  enabled: z.boolean().default(true),
})

export type Webhook = z.infer<typeof webhookSchema> & {
  id?: string
  created_at?: string
  updated_at?: string
}

