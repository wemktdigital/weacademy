'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { Pipeline, PipelineStep } from '@/lib/validations/pipeline.schema'
import type { Agent } from '@/lib/validations/agent.schema'

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deletePipelineId, setDeletePipelineId] = useState<string | null>(null)
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null)
  const [formData, setFormData] = useState<Partial<Pipeline>>({
    name: '',
    description: '',
    steps: [],
    active: true,
  })

  useEffect(() => {
    fetchPipelines()
    fetchAgents()
  }, [])

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/pipelines')
      if (!response.ok) throw new Error('Failed to fetch pipelines')
      const data = await response.json()
      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Error fetching pipelines:', error)
      toast.error('Erro ao carregar pipelines')
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.steps || formData.steps.length === 0) {
      toast.error('Adicione pelo menos um step ao pipeline')
      return
    }

    try {
      const url = editingPipeline
        ? `/api/lab-ia/admin/pipelines/${editingPipeline.id}`
        : '/api/lab-ia/admin/pipelines'

      const method = editingPipeline ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to save pipeline')

      toast.success(
        editingPipeline ? 'Pipeline atualizado com sucesso!' : 'Pipeline criado com sucesso!'
      )

      setOpenDialog(false)
      resetForm()
      fetchPipelines()
    } catch (error) {
      console.error('Error saving pipeline:', error)
      toast.error('Erro ao salvar pipeline')
    }
  }

  const handleDelete = async () => {
    if (!deletePipelineId) return

    try {
      const response = await fetch(`/api/lab-ia/admin/pipelines/${deletePipelineId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete pipeline')

      toast.success('Pipeline excluído com sucesso!')
      setDeletePipelineId(null)
      fetchPipelines()
    } catch (error) {
      console.error('Error deleting pipeline:', error)
      toast.error('Erro ao excluir pipeline')
    }
  }

  const addStep = () => {
    const newStep: PipelineStep = {
      order: (formData.steps?.length || 0) + 1,
      agent_id: agents[0]?.id || '',
    }

    setFormData({
      ...formData,
      steps: [...(formData.steps || []), newStep],
    })
  }

  const removeStep = (index: number) => {
    const newSteps = formData.steps?.filter((_, i) => i !== index) || []
    // Reorder
    const reorderedSteps = newSteps.map((step, i) => ({ ...step, order: i + 1 }))
    setFormData({ ...formData, steps: reorderedSteps })
  }

  const updateStep = (index: number, field: keyof PipelineStep, value: any) => {
    const newSteps = formData.steps?.map((step, i) =>
      i === index ? { ...step, [field]: value } : step
    )
    setFormData({ ...formData, steps: newSteps })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      steps: [],
      active: true,
    })
    setEditingPipeline(null)
  }

  const handleEdit = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline)
    setFormData(pipeline)
    setOpenDialog(true)
  }

  const getAgentName = (agentId: string) => {
    return agents.find(a => a.id === agentId)?.name || 'Agente não encontrado'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando pipelines...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🔗 Pipelines de Agentes</h1>
            <p className="text-muted-foreground mt-1">
              Crie pipelines colaborativos entre múltiplos agentes
            </p>
          </div>
          <Button onClick={() => {
            resetForm()
            setOpenDialog(true)
          }}>
            + Novo Pipeline
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                    <Badge className="mt-2" variant={pipeline.active ? 'default' : 'secondary'}>
                      {pipeline.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {pipeline.description || 'Sem descrição'}
                </p>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Etapas:</span>
                    <span className="font-semibold">{pipeline.steps?.length || 0}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <div className="flex flex-wrap gap-1">
                      {pipeline.steps?.slice(0, 3).map((step, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {getAgentName(step.agent_id).slice(0, 15)}...
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(pipeline)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeletePipelineId(pipeline.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPipeline ? 'Editar Pipeline' : 'Criar Novo Pipeline'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Resumo → Revisão → Tradução"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o pipeline..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Etapas do Pipeline *</Label>
                  <Button type="button" onClick={addStep} size="sm" variant="outline">
                    + Adicionar Etapa
                  </Button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {formData.steps?.map((step, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                      <Badge variant="secondary" className="mt-2">
                        #{step.order}
                      </Badge>
                      <Select
                        value={step.agent_id}
                        onValueChange={(value) => updateStep(index, 'agent_id', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um agente" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.filter(a => a.active).map((agent) => (
                            <SelectItem key={agent.id} value={agent.id!}>
                              {agent.icon} {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Pipeline ativo</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setOpenDialog(false)
                  resetForm()
                }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPipeline ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletePipelineId} onOpenChange={() => setDeletePipelineId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este pipeline? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
