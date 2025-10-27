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
  video_url: z.string().url().optional(),
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
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug inválido (use apenas letras minúsculas, números e hífens)'),
  description: z.string().min(50, 'Descrição deve ter no mínimo 50 caracteres'),
  short_description: z.string().max(200, 'Descrição curta deve ter no máximo 200 caracteres'),
  thumbnail_url: z.string().url().optional(),
  
  // Vídeo
  video_url: z.string().url().optional(),
  video_provider: z.enum(['youtube', 'vimeo', 'custom']).optional(),
  
  // Preço e status
  price: z.number().min(0, 'Preço não pode ser negativo').default(0),
  is_free: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  
  // Categoria e nível
  category_id: z.string().uuid().nullable().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  duration_hours: z.number().int().min(0).default(0),
  
  // Instrutor (opcional no create, será definido automaticamente)
  instructor_id: z.string().uuid().optional(),
  
  // Módulos e lições
  modules: z.array(moduleSchema.extend({
    lessons: z.array(lessonSchema)
  })).min(1, 'Curso deve ter pelo menos 1 módulo'),
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
