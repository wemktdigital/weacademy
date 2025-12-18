'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AchievementsTable, Achievement as TableAchievement } from '@/components/admin/gamification/AchievementsTable'
import { AchievementForm, Achievement } from '@/components/admin/gamification/AchievementForm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trophy, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function AchievementsAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [achievements, setAchievements] = useState<TableAchievement[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/access-denied')
      return
    }

    if (isAdmin) {
      loadAchievements()
    }
  }, [user, isAdmin, authLoading, router])

  const loadAchievements = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/gamification/achievements?include_stats=true', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar achievements')
      }

      const data = await response.json()

      // Ensure data conforms to Achievement[] type for Table
      const formattedAchievements: any[] = (data.achievements || []).map((item: any) => ({
        ...item,
        id: item.id || '', // Ensure id is string
      }))

      setAchievements(formattedAchievements)
    } catch (error: any) {
      console.error('Error loading achievements:', error)
      toast.error(error.message || 'Erro ao carregar achievements')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingAchievement(null)
    setDialogOpen(true)
  }

  const handleEdit = (achievement: Achievement) => {
    setEditingAchievement(achievement)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/admin/gamification/achievements/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar achievement')
      }

      await loadAchievements()
    } catch (error: any) {
      throw error
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/admin/gamification/achievements/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !active }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar achievement')
      }

      await loadAchievements()
    } catch (error: any) {
      throw error
    }
  }

  const handleSubmit = async (data: Achievement) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const url = editingAchievement
        ? `/api/admin/gamification/achievements/${editingAchievement.id}`
        : '/api/admin/gamification/achievements'

      const method = editingAchievement ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar achievement')
      }

      setDialogOpen(false)
      setEditingAchievement(null)
      await loadAchievements()
    } catch (error: any) {
      throw error
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/gamification">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center space-x-2">
                  <Trophy className="h-8 w-8 text-primary" />
                  <span>Achievements</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie badges e conquistas dos usuários
                </p>
              </div>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Achievement
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lista de Achievements</CardTitle>
            <CardDescription>
              Total: {achievements.length} achievement(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AchievementsTable
              achievements={achievements}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Formulário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAchievement ? 'Editar Achievement' : 'Criar Achievement'}
            </DialogTitle>
            <DialogDescription>
              {editingAchievement
                ? 'Atualize as informações do achievement'
                : 'Preencha as informações para criar um novo achievement'}
            </DialogDescription>
          </DialogHeader>
          <AchievementForm
            achievement={editingAchievement || undefined}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false)
              setEditingAchievement(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

