'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { CourseForm } from '@/components/admin/course-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

export default function NewCoursePage() {
  const router = useRouter()
  const { user, loading, isAdmin } = useAuth()
  const [categories, setCategories] = useState([])

  useEffect(() => {
    // Aguardar loading terminar antes de verificar permissões
    if (loading) return;
    
    if (!user || !isAdmin) {
      router.push('/access-denied')
      return
    }

    loadCategories()
  }, [user, isAdmin, router, loading])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error: any) {
      console.error('Error loading categories:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar categorias',
        variant: 'destructive',
      })
    }
  }

  const handleSubmit = async (data: any) => {
    try {
      // Obter a sessão do Supabase
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      
      if (process.env.NEXT_PUBLIC_LAB_DEBUG_AUTH === "1") {
        console.log("[LABAUTH][CLIENT] session", { 
          hasSession: !!sessionData?.session, 
          hasToken: !!accessToken,
          userId: sessionData?.session?.user?.id 
        });
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      // Adicionar token no header se disponível
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      const resultText = await response.clone().text();
      if (process.env.NEXT_PUBLIC_LAB_DEBUG_AUTH === "1") {
        console.log("[LABAUTH][CLIENT] submit", response.status, resultText);
      }

      const result = JSON.parse(resultText);

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar curso')
      }

      toast({
        title: 'Sucesso',
        description: 'Curso criado com sucesso!',
      })

      router.push('/admin/courses')
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  const handleCancel = () => {
    router.push('/admin/courses')
  }

  // Mostrar loading enquanto verifica permissões
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    )
  }

  // Se não for admin, não mostrar nada (já foi redirecionado)
  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Novo Curso</h1>
            <p className="text-muted-foreground mt-1">
              Crie um novo curso para a plataforma
            </p>
          </div>
        </div>

        <CourseForm
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
