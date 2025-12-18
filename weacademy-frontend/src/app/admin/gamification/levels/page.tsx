'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LevelsTable, Level as TableLevel } from '@/components/admin/gamification/LevelsTable'
import { LevelForm, Level } from '@/components/admin/gamification/LevelForm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Star, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function LevelsAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [levels, setLevels] = useState<TableLevel[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLevel, setEditingLevel] = useState<Level | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/access-denied')
      return
    }

    if (isAdmin) {
      loadLevels()
    }
  }, [user, isAdmin, authLoading, router])

  const loadLevels = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/gamification/levels?include_stats=true', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar níveis')
      }

      const data = await response.json()

      const formattedLevels: any[] = (data.levels || []).map((item: any) => ({
        ...item,
        id: item.id || '',
      }))

      setLevels(formattedLevels)
    } catch (error: any) {
      console.error('Error loading levels:', error)
      toast.error(error.message || 'Erro ao carregar níveis')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingLevel(null)
    setDialogOpen(true)
  }

  const handleEdit = (level: Level) => {
    setEditingLevel(level)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/admin/gamification/levels/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar nível')
      }

      await loadLevels()
    } catch (error: any) {
      throw error
    }
  }

  const handleSubmit = async (data: Level) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const url = editingLevel
        ? `/api/admin/gamification/levels/${editingLevel.id}`
        : '/api/admin/gamification/levels'

      const method = editingLevel ? 'PUT' : 'POST'

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
        throw new Error(error.error || 'Erro ao salvar nível')
      }

      setDialogOpen(false)
      setEditingLevel(null)
      await loadLevels()
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
                  <Star className="h-8 w-8 text-primary" />
                  <span>Níveis</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configure níveis e requisitos de XP
                </p>
              </div>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Nível
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lista de Níveis</CardTitle>
            <CardDescription>
              Total: {levels.length} nível(is)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LevelsTable
              levels={levels}
              onEdit={handleEdit}
              onDelete={handleDelete}
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
              {editingLevel ? 'Editar Nível' : 'Criar Nível'}
            </DialogTitle>
            <DialogDescription>
              {editingLevel
                ? 'Atualize as informações do nível'
                : 'Preencha as informações para criar um novo nível'}
            </DialogDescription>
          </DialogHeader>
          <LevelForm
            level={editingLevel || undefined}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false)
              setEditingLevel(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

