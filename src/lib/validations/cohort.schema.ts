import { z } from 'zod'

// Schema para criar/atualizar turma
export const cohortSchema = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  name: z.string().min(3, 'Nome da turma deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  capacity: z.number().int().min(1).max(1000).default(50),
  price_override: z.number().min(0).nullable().optional(),
  instructor_notes: z.string().optional(),
  status: z.enum(['open', 'closed', 'completed', 'cancelled']).default('open'),
}).refine(
  (data) => data.end_date >= data.start_date,
  {
    message: 'Data de término deve ser posterior à data de início',
    path: ['end_date'],
  }
)

// Schema para adicionar à lista de espera
export const waitlistSchema = z.object({
  cohort_id: z.string().uuid(),
})

// Schema para listar turmas (query params)
export const listCohortsSchema = z.object({
  course_id: z.string().uuid().optional(),
  status: z.enum(['open', 'closed', 'completed', 'cancelled']).optional(),
  start_date_from: z.coerce.date().optional(),
  start_date_to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Schema para estatísticas de turma
export const cohortStatsSchema = z.object({
  id: z.string().uuid(),
  enrolled_count: z.number().int(),
  waitlist_count: z.number().int(),
  completion_rate: z.number().min(0).max(100),
  average_rating: z.number().min(0).max(5).nullable(),
})

// Types
export type CohortInput = z.infer<typeof cohortSchema>
export type WaitlistInput = z.infer<typeof waitlistSchema>
export type ListCohortsInput = z.infer<typeof listCohortsSchema>
export type CohortStats = z.infer<typeof cohortStatsSchema>
