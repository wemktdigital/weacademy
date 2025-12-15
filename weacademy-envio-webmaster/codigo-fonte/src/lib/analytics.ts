import { supabase } from './supabase'

export interface EventMetadata {
  [key: string]: any
}

/**
 * Rastreia um evento no sistema
 * @param eventName - Nome do evento
 * @param metadata - Dados adicionais do evento
 */
export async function trackEvent(
  eventName: string,
  metadata: EventMetadata = {}
): Promise<void> {
  try {
    // Obter informações do navegador
    const pageUrl = typeof window !== 'undefined' ? window.location.href : null
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    // Chamar função do Supabase
    const { error } = await supabase.rpc('track_event', {
      event_name: eventName,
      event_metadata: metadata,
      page_url: pageUrl,
      user_agent: userAgent
    })

    if (error) {
      console.warn('Erro ao rastrear evento:', error)
      return false
    }
    return true
  } catch (error) {
    console.warn('Erro ao rastrear evento:', error)
    return false
  }
}

/**
 * Rastreia visualização de página
 * @param pagePath - Caminho da página
 */
export async function trackPageView(pagePath: string): Promise<void> {
  await trackEvent('page_view', {
    page_path: pagePath,
    page_title: typeof document !== 'undefined' ? document.title : null
  })
}

/**
 * Rastreia clique em botão
 * @param buttonName - Nome do botão
 * @param buttonLocation - Localização do botão
 */
export async function trackButtonClick(
  buttonName: string,
  buttonLocation?: string
): Promise<void> {
  await trackEvent('button_click', {
    button_name: buttonName,
    button_location: buttonLocation
  })
}

/**
 * Rastreia interação com curso
 * @param action - Ação realizada (enroll, view, complete, etc.)
 * @param courseId - ID do curso
 * @param courseName - Nome do curso
 */
export async function trackCourseAction(
  action: string,
  courseId: string,
  courseName?: string
): Promise<void> {
  await trackEvent('course_action', {
    action,
    course_id: courseId,
    course_name: courseName
  })
}

/**
 * Rastreia busca
 * @param searchTerm - Termo de busca
 * @param resultsCount - Quantidade de resultados
 */
export async function trackSearch(
  searchTerm: string,
  resultsCount?: number
): Promise<void> {
  await trackEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount
  })
}

/**
 * Rastreia evento de autenticação
 * @param action - Ação (login, logout, signup)
 * @param method - Método de autenticação
 */
export async function trackAuth(action: string, method?: string): Promise<void> {
  await trackEvent('auth_event', {
    action,
    method
  })
}

/**
 * Rastreia download
 * @param fileName - Nome do arquivo
 * @param fileType - Tipo do arquivo
 */
export async function trackDownload(
  fileName: string,
  fileType: string
): Promise<void> {
  await trackEvent('download', {
    file_name: fileName,
    file_type: fileType
  })
}

/**
 * Rastreia início de aula
 */
export async function trackLessonStart(
  courseId: string,
  lessonId: string,
  lessonName: string
): Promise<boolean> {
  return trackEvent('lesson_started', {
    course_id: courseId,
    lesson_id: lessonId,
    lesson_name: lessonName
  })
}

/**
 * Rastreia conclusão de aula
 */
export async function trackLessonComplete(
  courseId: string,
  lessonId: string,
  lessonName: string
): Promise<boolean> {
  return trackEvent('lesson_completed', {
    course_id: courseId,
    lesson_id: lessonId,
    lesson_name: lessonName
  })
}

/**
 * Rastreia início de quiz
 */
export async function trackQuizStart(
  quizId: string,
  quizName: string
): Promise<boolean> {
  return trackEvent('quiz_started', {
    quiz_id: quizId,
    quiz_name: quizName
  })
}

/**
 * Rastreia conclusão de quiz
 */
export async function trackQuizComplete(
  quizId: string,
  quizName: string,
  score: number,
  passed: boolean
): Promise<boolean> {
  return trackEvent('quiz_completed', {
    quiz_id: quizId,
    quiz_name: quizName,
    score,
    passed
  })
}

/**
 * Rastreia uso do Laboratório de IA
 */
export async function trackAILabUsage(
  action: string,
  agentId?: string,
  metadata?: EventMetadata
): Promise<boolean> {
  return trackEvent('ai_lab_usage', {
    action,
    agent_id: agentId,
    ...metadata
  })
}
