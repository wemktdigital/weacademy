import { supabase, Database } from './supabase'

// Tipos para RBAC
export type UserRole = 'admin' | 'user' | 'guest'

export interface User {
  id: string
  email: string
  role: UserRole
  full_name?: string
  avatar_url?: string
}

// Função para obter o usuário atual
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return {
    id: user.id,
    email: profile.email,
    role: profile.role as UserRole,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url
  }
}

// Função para verificar se usuário é admin
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}

// Função para verificar se usuário é user ou admin
export async function isUserOrAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'user' || user?.role === 'admin'
}

// Função para fazer login
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

// Função para fazer logout
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Função para registrar usuário
export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  })
  return { data, error }
}

// Função para atualizar role de usuário (apenas admins)
export async function updateUserRole(userId: string, newRole: UserRole) {
  const { data, error } = await supabase.rpc('update_user_role', {
    target_user_id: userId,
    new_role: newRole
  })
  return { data, error }
}

// Função para obter todos os usuários (apenas admins)
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

// Função para obter logs administrativos (apenas admins)
export async function getAdminLogs() {
  const { data, error } = await supabase
    .from('admin_logs')
    .select(`
      *,
      admin:profiles!admin_logs_admin_id_fkey(*),
      target_user:profiles!admin_logs_target_user_id_fkey(*)
    `)
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}
