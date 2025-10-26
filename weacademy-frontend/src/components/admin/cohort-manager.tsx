'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Save, Users, Calendar, DollarSign, UserPlus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Cohort {
  id?: string
  course_id: string
  name: string
  start_date: string
  end_date: string
  capacity: number
  price: number
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  enrolled_count: number
  instructor_id?: string
}

interface CohortManagerProps {
  courseId: string
  cohorts: Cohort[]
  onSubmit: (cohort: Omit<Cohort, 'enrolled_count'>) => Promise<void>
  onDelete?: (cohortId: string) => Promise<void>
  onEnroll?: (cohortId: string, studentId: string) => Promise<void>
}

export function CohortManager({ courseId, cohorts, onSubmit, onDelete, onEnroll }: CohortManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<Omit<Cohort, 'enrolled_count'>>({
    course_id: courseId,
    name: '',
    start_date: '',
    end_date: '',
    capacity: 20,
    price: 0,
    status: 'upcoming',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da turma é obrigatório',
        variant: 'destructive',
      })
      return
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast({
        title: 'Erro',
        description: 'Data de fim deve ser posterior à data de início',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      await onSubmit(formData)
      
      // Reset form
      setFormData({
        course_id: courseId,
        name: '',
        start_date: '',
        end_date: '',
        capacity: 20,
        price: 0,
        status: 'upcoming',
      })
      setShowForm(false)
      setEditingCohort(null)
      
      toast({
        title: 'Sucesso',
        description: editingCohort ? 'Turma atualizada com sucesso' : 'Turma criada com sucesso',
      })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (cohort: Cohort) => {
    setEditingCohort(cohort)
    setFormData(cohort)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCohort(null)
    setFormData({
      course_id: courseId,
      name: '',
      start_date: '',
      end_date: '',
      capacity: 20,
      price: 0,
      status: 'upcoming',
    })
  }

  const handleDelete = async (cohortId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta turma?')) return
    try {
      await onDelete?.(cohortId)
      toast({
        title: 'Sucesso',
        description: 'Turma deletada com sucesso',
      })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      upcoming: 'outline',
      active: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    }
    
    const labels: Record<string, string> = {
      upcoming: 'Em Breve',
      active: 'Ativa',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    }

    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>
  }

  const isFull = (cohort: Cohort) => {
    return cohort.enrolled_count >= cohort.capacity
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Turmas</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie as turmas deste curso
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Turma
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCohort ? 'Editar Turma' : 'Nova Turma'}</CardTitle>
            <CardDescription>
              Configure as informações da turma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Turma *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Turma Janeiro 2024"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  >
                    <option value="upcoming">Em Breve</option>
                    <option value="active">Ativa</option>
                    <option value="completed">Concluída</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Término *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidade *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Número máximo de estudantes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe 0 para gratuito
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Salvando...' : editingCohort ? 'Atualizar' : 'Criar Turma'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {cohorts.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhuma turma criada ainda
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeira Turma
            </Button>
          </CardContent>
        </Card>
      )}

      {cohorts.length > 0 && (
        <div className="grid gap-4">
          {cohorts.map((cohort) => (
            <Card key={cohort.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{cohort.name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(cohort.start_date).toLocaleDateString('pt-BR')} - {new Date(cohort.end_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  {getStatusBadge(cohort.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Inscritos</p>
                      <p className="font-semibold">
                        {cohort.enrolled_count} / {cohort.capacity}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Preço</p>
                      <p className="font-semibold">
                        {cohort.price === 0 ? 'Gratuito' : `R$ ${cohort.price.toFixed(2)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-200">
                      <div 
                        className="w-full h-full rounded-full bg-primary transition-all"
                        style={{ 
                          height: `${Math.min((cohort.enrolled_count / cohort.capacity) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ocupação</p>
                      <p className="font-semibold">
                        {Math.round((cohort.enrolled_count / cohort.capacity) * 100)}%
                      </p>
                    </div>
                  </div>

                  {isFull(cohort) && (
                    <Badge variant="destructive">Lotada</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(cohort)}
                  >
                    Editar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(cohort.id!)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Deletar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
