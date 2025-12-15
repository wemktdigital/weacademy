import { useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  trackEvent,
  trackPageView,
  trackClick,
  trackNavigation,
  trackCourseStart,
  trackCourseComplete,
  trackLessonStart,
  trackLessonComplete,
  trackQuizStart,
  trackQuizComplete,
  trackUserLogin,
  trackUserLogout,
  trackFileDownload,
  trackFileUpload,
  trackAILabUsage,
  trackSearch,
  EventMetadata,
} from '@/lib/analytics/eventTracking'

export interface UseEventTrackingReturn {
  trackEvent: (eventName: string, metadata?: EventMetadata) => Promise<boolean>
  trackPageView: (pageName: string, metadata?: EventMetadata) => Promise<boolean>
  trackClick: (elementName: string, metadata?: EventMetadata) => Promise<boolean>
  trackNavigation: (from: string, to: string, metadata?: EventMetadata) => Promise<boolean>
  trackCourseStart: (courseId: string, courseName: string) => Promise<boolean>
  trackCourseComplete: (courseId: string, courseName: string) => Promise<boolean>
  trackLessonStart: (courseId: string, lessonId: string, lessonName: string) => Promise<boolean>
  trackLessonComplete: (courseId: string, lessonId: string, lessonName: string) => Promise<boolean>
  trackQuizStart: (quizId: string, quizName: string) => Promise<boolean>
  trackQuizComplete: (quizId: string, quizName: string, score: number, passed: boolean) => Promise<boolean>
  trackUserLogin: (method?: string) => Promise<boolean>
  trackUserLogout: () => Promise<boolean>
  trackFileDownload: (fileName: string, fileType: string, fileSize?: number) => Promise<boolean>
  trackFileUpload: (fileName: string, fileType: string, fileSize?: number) => Promise<boolean>
  trackAILabUsage: (action: string, agentId?: string, metadata?: EventMetadata) => Promise<boolean>
  trackSearch: (query: string, resultsCount?: number, category?: string) => Promise<boolean>
}

/**
 * Hook para rastreamento de eventos
 * Automaticamente rastreia visualizações de página
 */
export function useEventTracking(): UseEventTrackingReturn {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPathname = useRef<string>('')

  // Rastrear automaticamente visualizações de página
  useEffect(() => {
    // Evitar rastrear a mesma página múltiplas vezes
    const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    
    if (currentPath !== lastPathname.current) {
      lastPathname.current = currentPath
      
      // Extrair nome da página do pathname
      const pageName = pathname
        .split('/')
        .filter(Boolean)
        .join('_') || 'home'
      
      // Aguardar um pouco para garantir que a página carregou
      const timer = setTimeout(() => {
        trackPageView(pageName, {
          path: pathname,
          query: searchParams?.toString() || null
        })
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [pathname, searchParams])

  return {
    trackEvent: useCallback((eventName: string, metadata?: EventMetadata) => {
      return trackEvent({ eventName, metadata })
    }, []),
    trackPageView: useCallback((pageName: string, metadata?: EventMetadata) => {
      return trackPageView(pageName, metadata)
    }, []),
    trackClick: useCallback((elementName: string, metadata?: EventMetadata) => {
      return trackClick(elementName, metadata)
    }, []),
    trackNavigation: useCallback((from: string, to: string, metadata?: EventMetadata) => {
      return trackNavigation(from, to, metadata)
    }, []),
    trackCourseStart: useCallback((courseId: string, courseName: string) => {
      return trackCourseStart(courseId, courseName)
    }, []),
    trackCourseComplete: useCallback((courseId: string, courseName: string) => {
      return trackCourseComplete(courseId, courseName)
    }, []),
    trackLessonStart: useCallback((courseId: string, lessonId: string, lessonName: string) => {
      return trackLessonStart(courseId, lessonId, lessonName)
    }, []),
    trackLessonComplete: useCallback((courseId: string, lessonId: string, lessonName: string) => {
      return trackLessonComplete(courseId, lessonId, lessonName)
    }, []),
    trackQuizStart: useCallback((quizId: string, quizName: string) => {
      return trackQuizStart(quizId, quizName)
    }, []),
    trackQuizComplete: useCallback((quizId: string, quizName: string, score: number, passed: boolean) => {
      return trackQuizComplete(quizId, quizName, score, passed)
    }, []),
    trackUserLogin: useCallback((method?: string) => {
      return trackUserLogin(method)
    }, []),
    trackUserLogout: useCallback(() => {
      return trackUserLogout()
    }, []),
    trackFileDownload: useCallback((fileName: string, fileType: string, fileSize?: number) => {
      return trackFileDownload(fileName, fileType, fileSize)
    }, []),
    trackFileUpload: useCallback((fileName: string, fileType: string, fileSize?: number) => {
      return trackFileUpload(fileName, fileType, fileSize)
    }, []),
    trackAILabUsage: useCallback((action: string, agentId?: string, metadata?: EventMetadata) => {
      return trackAILabUsage(action, agentId, metadata)
    }, []),
    trackSearch: useCallback((query: string, resultsCount?: number, category?: string) => {
      return trackSearch(query, resultsCount, category)
    }, []),
  }
}

