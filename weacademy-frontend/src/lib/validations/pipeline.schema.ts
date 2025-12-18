import { z } from 'zod'

// Schema para condições condicionais
export const conditionSchema = z.object({
  type: z.enum(['contains', 'length', 'regex', 'sentiment']),
  value: z.union([z.string(), z.number()]),
  operator: z.enum(['equals', 'greater', 'less', 'not_equals']).optional(),
}).passthrough()

// Schema para configuração de retry
export const retryConfigSchema = z.object({
  maxTries: z.number().int().positive().max(10).optional(), // Máximo de tentativas (default: 3)
  baseDelay: z.number().int().positive().optional(), // Delay base em ms (default: 1000)
  maxDelay: z.number().int().positive().optional(), // Delay máximo em ms (default: 10000)
  timeout: z.number().int().positive().optional(), // Timeout por tentativa em ms (default: 30000)
  retryableErrors: z.array(z.string()).optional(), // Tipos de erro que devem ter retry
}).passthrough()

// Schema para transformações de output
export const transformationConfigSchema = z.object({
  type: z.enum(['truncate', 'summarize', 'format', 'extract_json', 'extract_text', 'uppercase', 'lowercase', 'capitalize']),
  params: z.object({
    maxLength: z.number().int().positive().optional(),
    format: z.string().optional(),
    extractKey: z.string().optional(),
  }).optional(),
}).passthrough()

export const pipelineStepSchema = z.object({
  order: z.number().int().positive(),
  agent_id: z.string().uuid(),
  condition: conditionSchema.optional(), // Condição para executar esta etapa
  merge_strategy: z.enum(['concat', 'first', 'last', 'longest']).optional(), // Como mergear se houver múltiplos caminhos
  retry_config: retryConfigSchema.optional(), // Configuração de retry para este step
  timeout: z.number().int().positive().optional(), // Timeout específico para este step (em ms)
  fallback_agent_id: z.string().uuid().optional(), // Agente alternativo caso falhe
  strict_validation: z.boolean().optional(), // Se true, bloqueia execução se validação falhar (default: false)
  prompt_template: z.string().optional(), // Template do prompt com variáveis (sobrescreve prompt do agente)
  output_transform: z.array(transformationConfigSchema).optional(), // Transformações a aplicar no output
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(), // Variáveis customizadas para este step
})

export const pipelineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  steps: z.array(pipelineStepSchema).min(1, 'Pipeline deve ter pelo menos um passo'),
  active: z.boolean().default(true),
  draft: z.boolean().optional(),
  last_tested_at: z.string().optional(),
}).passthrough() // Permitir campos adicionais sem erro

export type PipelineStep = z.infer<typeof pipelineStepSchema>

export type Pipeline = z.infer<typeof pipelineSchema> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type PipelineFormData = z.infer<typeof pipelineSchema>
