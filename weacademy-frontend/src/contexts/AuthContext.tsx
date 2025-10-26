'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, getCurrentUser, signIn, signOut, signUp } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  isAdmin: boolean
  isUserOrAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obter sessão inicial
    const getInitialSession = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Erro ao obter usuário:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const currentUser = await getCurrentUser()
          setUser(currentUser)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignIn = async (email: string, password: string) => {
    const result = await signIn(email, password)
    if (result.data) {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    }
    return result
  }

  const handleSignUp = async (email: string, password: string, fullName?: string) => {
    const result = await signUp(email, password, fullName)
    if (result.data) {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    }
    return result
  }

  const handleSignOut = async () => {
    const result = await signOut()
    setUser(null)
    return result
  }

  const isAdmin = user?.role === 'admin'
  const isUserOrAdmin = user?.role === 'user' || user?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        isAdmin,
        isUserOrAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
