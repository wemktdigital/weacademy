import { Course, User } from './course'

// Enrollment Types
export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  cohort_id: string | null
  status: 'active' | 'completed' | 'cancelled' | 'refunded'
  enrolled_at: Date
  completed_at: Date | null
  progress_percentage: number
  
  // Relações
  course?: Course
  cohort?: Cohort
  user?: User
}

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  completed_at: Date
  watch_time_seconds: number
}

// Cohort Types
export interface Cohort {
  id: string
  course_id: string
  name: string
  description: string | null
  start_date: Date
  end_date: Date
  capacity: number
  enrolled_count: number
  price_override: number | null
  instructor_notes: string | null
  status: 'open' | 'closed' | 'completed' | 'cancelled'
  created_at: Date
  updated_at: Date
  
  // Relações
  course?: Course
  enrollments?: Enrollment[]
  waitlist?: Waitlist[]
}

export interface Waitlist {
  id: string
  cohort_id: string
  user_id: string
  position: number
  notified_at: Date | null
  enrolled_at: Date | null
  created_at: Date
  
  // Relações
  cohort?: Cohort
  user?: User
}
