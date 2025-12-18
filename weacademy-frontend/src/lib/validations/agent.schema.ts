import { z } from 'zod'

export const agentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  icon: z.string().optional(),
  type: z.enum(['llm', 'automation']),
  provider: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().min(10, 'Prompt deve ter no mínimo 10 caracteres'),
  category: z.string().optional(),
  active: z.boolean().default(true),
  knowledge_base_files: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    })
  ).optional(),
  input_schema: z.union([
    z.string(), // JSON string
    z.record(z.string(), z.any()), // Objeto JSON
    z.any(), // Zod schema ou outros formatos
  ]).optional(), // Schema de validação para input (usando Zod)
  output_schema: z.union([
    z.string(), // JSON string
    z.record(z.string(), z.any()), // Objeto JSON
    z.any(), // Zod schema ou outros formatos
  ]).optional(), // Schema de validação para output (usando Zod)
  usage_instructions: z.string()
    .max(2000, 'Instruções muito longas (máximo 2000 caracteres)')
    .optional(),
  expected_result: z.string()
    .max(1000, 'Descrição muito longa (máximo 1000 caracteres)')
    .optional(),
}).passthrough() // Permitir campos adicionais sem erro

export type Agent = z.infer<typeof agentSchema> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type AgentFormData = z.infer<typeof agentSchema>
