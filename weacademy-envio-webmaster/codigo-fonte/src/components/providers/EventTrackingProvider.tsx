'use client'

import React, { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { trackPageView, trackEvent } from '@/lib/analytics'

/**
 * Provider que rastreia automaticamente eventos na aplicação
 * - Visualizações de página
 * - Login/logout de usuários
 */
export function EventTrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const lastPathnameRef = useRef<string>('')
  const lastUserRef = useRef<string | null>(null)

  // Rastrear visualizações de página
  useEffect(() => {
    const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    
    // Evitar rastrear a mesma página múltiplas vezes
    if (currentPath !== lastPathnameRef.current) {
      lastPathnameRef.current = currentPath
      
      // Extrair nome da página do pathname
      const pageName = pathname
        .split('/')
        .filter(Boolean)
        .join('_') || 'home'
      
      // Aguardar um pouco para garantir que a página carregou
      const timer = setTimeout(() => {
        trackPageView(pageName)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [pathname, searchParams])

  // Rastrear login/logout
  useEffect(() => {
    const currentUserId = user?.id || null
    
    // Detectar login (usuário mudou de null para um ID)
    if (lastUserRef.current === null && currentUserId !== null) {
      trackEvent('user_login', {
        user_id: currentUserId,
        login_method: 'email'
      })
    }
    
    // Detectar logout (usuário mudou de um ID para null)
    if (lastUserRef.current !== null && currentUserId === null) {
      trackEvent('user_logout', {})
    }
    
    lastUserRef.current = currentUserId
  }, [user])

  return <>{children}</>
}

