import { z } from 'zod'

export const agentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  icon: z.string().optional(),
  type: z.enum(['llm', 'automation'], {
    errorMap: () => ({ message: 'Tipo deve ser "llm" ou "automation"' }),
  }),
  provider: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().min(10, 'Prompt deve ter no mínimo 10 caracteres'),
  category: z.string().optional(),
  active: z.boolean().default(true),
})

export type Agent = z.infer<typeof agentSchema> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type AgentFormData = z.infer<typeof agentSchema>
