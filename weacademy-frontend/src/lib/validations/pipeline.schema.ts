import { z } from 'zod'

export const pipelineStepSchema = z.object({
  order: z.number().int().positive(),
  agent_id: z.string().uuid(),
})

export const pipelineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  steps: z.array(pipelineStepSchema).min(1, 'Pipeline deve ter pelo menos um passo'),
  active: z.boolean().default(true),
})

export type PipelineStep = z.infer<typeof pipelineStepSchema>

export type Pipeline = z.infer<typeof pipelineSchema> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type PipelineFormData = z.infer<typeof pipelineSchema>
