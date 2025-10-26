// Types para Course
export interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  short_description: string | null
  thumbnail_url: string | null
  video_url: string | null
  video_provider: 'youtube' | 'vimeo' | 'custom' | null
  price: number
  is_free: boolean
  is_published: boolean
  status: 'draft' | 'published' | 'archived'
  level: 'beginner' | 'intermediate' | 'advanced'
  duration_hours: number
  category_id: string | null
  instructor_id: string
  created_at: Date
  updated_at: Date
  
  // Relações
  category?: Category
  instructor?: User
  modules?: Module[]
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
  created_at: Date
  updated_at: Date
  
  // Relações
  course?: Course
  lessons?: Lesson[]
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  description: string | null
  content: string | null
  type: 'video' | 'text' | 'pdf' | 'quiz' | 'audio'
  video_url: string | null
  video_provider: 'youtube' | 'vimeo' | null
  attachments: string[] | null
  duration_minutes: number
  is_preview: boolean
  is_free: boolean
  order_index: number
  created_at: Date
  updated_at: Date
  
  // Relações
  module?: Module
  quiz?: Quiz
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  created_at: Date
  updated_at: Date
}

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'user' | 'guest'
  bio: string | null
}

export interface Quiz {
  id: string
  lesson_id: string
  title: string
  description: string | null
  passing_score: number
  allow_retake: boolean
  max_attempts: number
  time_limit_minutes: number
  show_results: boolean
  created_at: Date
  updated_at: Date
}
