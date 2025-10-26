import { z } from 'zod'

// Schema para criar inscrição
export const createEnrollmentSchema = z.object({
  course_id: z.string().uuid(),
  cohort_id: z.string().uuid().nullable().optional(),
})

// Schema para atualizar progresso
export const updateProgressSchema = z.object({
  lesson_id: z.string().uuid(),
  watch_time_seconds: z.number().int().min(0).default(0),
  completed: z.boolean().default(false),
})

// Schema para marcar curso como completo
export const completeCourseSchema = z.object({
  course_id: z.string().uuid(),
})

// Schema para retornar inscrição
export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  course_id: z.string().uuid(),
  cohort_id: z.string().uuid().nullable(),
  status: z.enum(['active', 'completed', 'cancelled', 'refunded']),
  progress_percentage: z.number().min(0).max(100),
  enrolled_at: z.date(),
  completed_at: z.date().nullable(),
})

// Schema para progresso de lição
export const lessonProgressSchema = z.object({
  id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  completed_at: z.date().nullable(),
  watch_time_seconds: z.number().int(),
})

// Schema para listar minhas inscrições
export const listEnrollmentsSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled', 'refunded']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Types
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>
export type CompleteCourseInput = z.infer<typeof completeCourseSchema>
export type Enrollment = z.infer<typeof enrollmentSchema>
export type LessonProgress = z.infer<typeof lessonProgressSchema>
export type ListEnrollmentsInput = z.infer<typeof listEnrollmentsSchema>
