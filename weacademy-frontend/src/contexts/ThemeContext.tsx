'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [userId, setUserId] = useState<string | null>(null)

  // Obter ID do usuário autenticado
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Função para obter o tema do sistema
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }

  // Função para aplicar o tema ao DOM
  const applyTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    root.setAttribute('data-theme', theme)
  }

  // Função para resolver o tema baseado na preferência
  const resolveTheme = (themePreference: Theme): 'light' | 'dark' => {
    if (themePreference === 'system') {
      return getSystemTheme()
    }
    return themePreference
  }

  // Carregar tema do usuário
  useEffect(() => {
    const loadUserTheme = async () => {
      if (userId) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('theme')
            .eq('id', userId)
            .single()

          if (profile?.theme) {
            setThemeState(profile.theme)
            const resolved = resolveTheme(profile.theme)
            setResolvedTheme(resolved)
            applyTheme(resolved)
          }
        } catch (error) {
          console.error('Erro ao carregar tema do usuário:', error)
        }
      }
    }

    loadUserTheme()
  }, [userId])

  // Escutar mudanças no tema do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = getSystemTheme()
        setResolvedTheme(resolved)
        applyTheme(resolved)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Aplicar tema inicial
  useEffect(() => {
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme])

  // Função para definir tema
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    
    // Salvar no banco de dados se usuário estiver logado
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({ theme: newTheme })
          .eq('id', userId)
      } catch (error) {
        console.error('Erro ao salvar tema:', error)
      }
    } else {
      // Salvar no localStorage para usuários não logados
      localStorage.setItem('theme', newTheme)
    }
  }

  // Função para alternar entre light/dark
  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  // Carregar tema do localStorage se usuário não estiver logado
  useEffect(() => {
    if (!userId) {
      const savedTheme = localStorage.getItem('theme') as Theme
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme)
      }
    }
  }, [userId])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider')
  }
  return context
}
