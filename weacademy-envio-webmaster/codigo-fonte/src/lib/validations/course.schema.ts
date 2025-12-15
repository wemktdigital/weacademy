import { z } from 'zod'

// Schema para módulo
export const moduleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  order_index: z.number().int().min(0),
})

// Schema para lição
export const lessonSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  type: z.enum(['video', 'text', 'pdf', 'quiz', 'audio']),
  content: z.string().optional(),
  video_url: z.string().url().optional().or(z.literal('')),
  video_provider: z.enum(['youtube', 'vimeo']).optional(),
  attachments: z.array(z.string()).optional(),
  duration_minutes: z.number().int().min(0).default(0),
  is_preview: z.boolean().default(false),
  is_free: z.boolean().default(false),
  order_index: z.number().int().min(0),
})

// Schema para criar curso completo
export const createCourseSchema = z.object({
  // Informações básicas
  title: z.string()
    .min(3, 'Título deve ter no mínimo 3 caracteres')
    .max(200, 'Título deve ter no máximo 200 caracteres'),
  
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug inválido. Use apenas letras minúsculas, números e hífens')
    .min(3, 'Slug deve ter no mínimo 3 caracteres')
    .max(100, 'Slug deve ter no máximo 100 caracteres'),
  
  description: z.string()
    .optional()
    .refine((val) => {
      // Aceitar undefined, string vazia OU string com no mínimo 50 caracteres
      if (!val) return true
      if (val === '') return true
      return val.length >= 50
    }, 'Descrição deve ter no mínimo 50 caracteres'),
  
  short_description: z.string()
    .optional()
    .refine((val) => !val || val.length <= 200, 'Descrição curta deve ter no máximo 200 caracteres'),
  
  thumbnail_url: z.string()
    .optional()
    .refine((val) => !val || val === '' || z.string().url().safeParse(val).success, 'URL da thumbnail inválida'),
  
  // Vídeo
  video_url: z.string()
    .optional()
    .refine((val) => !val || val === '' || z.string().url().safeParse(val).success, 'URL do vídeo inválida'),
  
  video_provider: z.enum(['youtube', 'vimeo', 'custom']).optional(),
  
  // Preço e status
  price: z.number()
    .min(0, 'Preço não pode ser negativo')
    .max(100000, 'Preço muito alto')
    .default(0),
  
  is_free: z.boolean().default(false),
  
  status: z.enum(['draft', 'published', 'archived'])
    .default('draft'),
  
  // Categoria e nível
  category_id: z.string().uuid('ID de categoria inválido')
    .nullable()
    .optional(),
  
  level: z.enum(['beginner', 'intermediate', 'advanced'])
    .default('beginner'),
  
  duration_hours: z.number()
    .int('Duração deve ser um número inteiro')
    .min(0, 'Duração não pode ser negativa')
    .max(1000, 'Duração muito alta')
    .default(0),
  
  // Instrutor
  instructor_id: z.string().uuid('ID de instrutor inválido')
    .optional(),
  
  // Módulos e lições
  modules: z.array(moduleSchema.extend({
    lessons: z.array(lessonSchema)
  }))
    .optional()
    .default([]),
})

// Schema para atualizar curso
export const updateCourseSchema = createCourseSchema.partial()

// Schema para listar cursos (query params)
export const listCoursesSchema = z.object({
  category: z.string().uuid().optional(),
  instructor: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Types
export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type ListCoursesInput = z.infer<typeof listCoursesSchema>
export type ModuleInput = z.infer<typeof moduleSchema>
export type LessonInput = z.infer<typeof lessonSchema>
