import { z } from 'zod'

// Schema para opção de resposta
export const questionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  option_text: z.string().min(1, 'Opção deve ter pelo menos 1 caractere'),
  is_correct: z.boolean().default(false),
  order_index: z.number().int().min(0).default(0),
})

// Schema para questão
export const questionSchema = z.object({
  id: z.string().uuid().optional(),
  question_text: z.string().min(5, 'Pergunta deve ter no mínimo 5 caracteres'),
  type: z.enum(['single_choice', 'multiple_choice', 'true_false', 'short_answer']),
  points: z.number().int().min(1).default(1),
  explanation: z.string().optional(),
  order_index: z.number().int().min(0).default(0),
  options: z.array(questionOptionSchema).min(2, 'Questão deve ter pelo menos 2 opções'),
})

// Schema para quiz
export const quizSchema = z.object({
  id: z.string().uuid().optional(),
  lesson_id: z.string().uuid(),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  passing_score: z.number().int().min(0).max(100).default(70),
  allow_retake: z.boolean().default(true),
  max_attempts: z.number().int().min(1).default(3),
  time_limit_minutes: z.number().int().min(0).default(30),
  show_results: z.boolean().default(true),
  questions: z.array(questionSchema).min(1, 'Quiz deve ter pelo menos 1 questão'),
})

// Schema para submeter quiz
export const submitQuizSchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z.record(z.string(), z.array(z.string())), // {question_id: [option_ids]}
  time_taken_seconds: z.number().int().min(0).default(0),
})

// Schema para tentativa de quiz (retorno)
export const quizAttemptSchema = z.object({
  id: z.string().uuid(),
  quiz_id: z.string().uuid(),
  user_id: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  time_taken_seconds: z.number().int(),
  submitted_at: z.date(),
  completed: z.boolean(),
})

// Types
export type QuizInput = z.infer<typeof quizSchema>
export type QuestionInput = z.infer<typeof questionSchema>
export type QuestionOptionInput = z.infer<typeof questionOptionSchema>
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>
export type QuizAttempt = z.infer<typeof quizAttemptSchema>
