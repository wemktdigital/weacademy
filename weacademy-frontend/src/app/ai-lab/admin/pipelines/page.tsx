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
import { supabase } from '@/lib/supabase'
import type { Pipeline, PipelineStep } from '@/lib/validations/pipeline.schema'
import type { Agent } from '@/lib/validations/agent.schema'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, FlaskConical, Workflow, Calendar, Database, TrendingUp, Bug, GitBranch, BarChart3, Brain, Activity, ClipboardList } from 'lucide-react'
import { PipelineTester } from '@/modules/laboratorio-ia/components/PipelineTester'
import { DebugModePanel } from '@/modules/laboratorio-ia/components/DebugModePanel'
import { PipelineVersionsPanel } from '@/modules/laboratorio-ia/components/PipelineVersionsPanel'

export default function PipelinesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deletePipelineId, setDeletePipelineId] = useState<string | null>(null)
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null)
  const [testingPipeline, setTestingPipeline] = useState<Pipeline | null>(null)
  const [debugPipeline, setDebugPipeline] = useState<Pipeline | null>(null)
  const [versionsPipeline, setVersionsPipeline] = useState<Pipeline | null>(null)
  const [formData, setFormData] = useState<Partial<Pipeline>>({
    name: '',
    description: '',
    steps: [],
    active: true,
    draft: false,
  })

  useEffect(() => {
    fetchPipelines()
    fetchAgents()
  }, [])

  useEffect(() => {
    // Carregar template após agentes estarem disponíveis
    const templateId = searchParams?.get('template')
    if (templateId && agents.length > 0) {
      loadTemplateFromUrl()
    }
  }, [agents.length, searchParams])

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
      // Usar endpoint público (agentes ativos) para evitar exigência de autenticação admin aqui
      const response = await fetch('/api/lab-ia/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const loadTemplateFromUrl = async () => {
    try {
      const templateId = searchParams?.get('template')
      if (!templateId) return

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines/templates/${templateId}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      })

      if (!response.ok) {
        // Se não encontrar por ID, tenta usar dados da URL
        const name = searchParams?.get('name')
        const description = searchParams?.get('description')
        const category = searchParams?.get('category')

        if (name) {
          setFormData({
            name,
            description: description || '',
            steps: [],
            active: true,
            draft: false,
          })
          setOpenDialog(true)
          toast.success('Template carregado da URL. Configure os agentes para cada etapa.')
          return
        }
        throw new Error('Template não encontrado')
      }

      const template = await response.json()
      
      // Garantir que template.steps seja um array
      if (!Array.isArray(template.steps) || template.steps.length === 0) {
        setFormData({
          name: template.name,
          description: template.description || '',
          steps: [],
          active: true,
          draft: false,
        })
        setOpenDialog(true)
        toast.warning(`Template "${template.name}" carregado, mas não há etapas configuradas no template.`)
        return
      }
      
      // Converter steps do template para formato do pipeline
      // O template tem agent_name, mas precisamos encontrar os agent_id correspondentes
      const steps: PipelineStep[] = template.steps.map((step: any, index: number) => {
        const agentName = step.agent_name || step.name || ''
        
        // Tentar encontrar o agente pelo nome (busca mais flexível)
        const agent = agents.find(a => {
          if (!agentName) return false
          
          const agentNameLower = a.name.toLowerCase().trim()
          const stepNameLower = agentName.toLowerCase().trim()
          
          // Match exato (case-insensitive)
          if (agentNameLower === stepNameLower) return true
          
          // Match parcial (um contém o outro)
          if (agentNameLower.includes(stepNameLower) || stepNameLower.includes(agentNameLower)) return true
          
          // Match por palavras-chave comuns
          const stopWords = ['de', 'em', 'para', 'com', 'por', 'ao', 'da', 'do', 'no', 'na']
          const agentKeywords = agentNameLower.split(/\s+/).filter(k => k.length > 2 && !stopWords.includes(k))
          const stepKeywords = stepNameLower.split(/\s+/).filter(k => k.length > 2 && !stopWords.includes(k))
          const commonKeywords = agentKeywords.filter(k => stepKeywords.includes(k))
          
          // Se houver pelo menos 2 palavras-chave em comum, considera match
          if (commonKeywords.length >= 2) return true
          
          return false
        })
        
        return {
          order: step.order || index + 1,
          agent_id: agent?.id || '',
        }
      })

      const stepsWithAgents = steps.filter(s => s.agent_id !== '')

      setFormData({
        name: template.name,
        description: template.description || '',
        steps: steps,
        active: true,
        draft: false,
      })

      setOpenDialog(true)
      
      if (steps.length === 0) {
        toast.warning(`Template "${template.name}" não tem etapas configuradas.`)
      } else if (stepsWithAgents.length === steps.length) {
        toast.success(`Template "${template.name}" carregado com ${steps.length} etapa(s)!`)
      } else {
        toast.success(`Template "${template.name}" carregado! ${stepsWithAgents.length} de ${steps.length} agente(s) encontrado(s). Configure os restantes manualmente.`)
      }
    } catch (error) {
      console.error('Error loading template:', error)
      // Não mostrar erro se não houver template na URL
      if (searchParams?.get('template')) {
        toast.error('Erro ao carregar template')
      }
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

      // Capturar token da sessão para enviar no header Authorization
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      console.log('[Pipeline] Enviando pipeline:', {
        url,
        method,
        hasToken: !!token,
        formData: {
          name: formData.name,
          stepsCount: formData.steps?.length,
          active: formData.active,
          draft: formData.draft,
        },
      })

      const response = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        let details = 'Failed to save pipeline'
        let errorData: any = {}
        try {
          errorData = await response.json()
          details = errorData?.error || errorData?.message || details
          console.error('[Pipeline] Erro ao salvar pipeline:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          })
        } catch (err) {
          console.error('[Pipeline] Erro ao parsear resposta de erro:', err)
        }
        throw new Error(`${details} (${response.status})`)
      }

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
      draft: false,
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
          <div className="flex gap-2">
            <Link href="/ai-lab/admin/pipelines/templates">
              <Button variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </Link>
            <Link href="/ai-lab/admin/pipelines/schedules">
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Agendamentos
              </Button>
            </Link>
            <Link href="/ai-lab/admin/knowledge-bases">
              <Button variant="outline">
                <Database className="h-4 w-4 mr-2" />
                Knowledge Bases
              </Button>
            </Link>
            <Link href="/ai-lab/admin/cost-analytics">
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Analytics de Custo
              </Button>
            </Link>
            <Link href="/ai-lab/admin/workflows/metrics">
              <Button variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Observabilidade
              </Button>
            </Link>
            <Link href="/ai-lab/admin/workflows/human-tasks">
              <Button variant="outline">
                <ClipboardList className="h-4 w-4 mr-2" />
                Tarefas Humanas
              </Button>
            </Link>
            <Link href="/ai-lab/admin/pipelines/ab-experiments">
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                A/B Testing
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => router.push('/ai-lab/admin/pipelines/editor')}
            >
              <Workflow className="h-4 w-4 mr-2" />
              Editor Visual
            </Button>
            <Button onClick={() => {
              resetForm()
              setOpenDialog(true)
            }}>
              + Novo Pipeline
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={pipeline.active ? 'default' : 'secondary'}>
                        {pipeline.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {pipeline.draft && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500">
                          Rascunho
                        </Badge>
                      )}
                    </div>
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
                  {pipeline.last_tested_at && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      ✅ Testado em {new Date(pipeline.last_tested_at).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestingPipeline(pipeline)}
                  >
                    <FlaskConical className="h-4 w-4 mr-1" />
                    Testar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDebugPipeline(pipeline)}
                  >
                    <Bug className="h-4 w-4 mr-1" />
                    Debug
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVersionsPipeline(pipeline)}
                  >
                    <GitBranch className="h-4 w-4 mr-1" />
                    Versões
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/ai-lab/admin/pipelines/${pipeline.id}/analytics`)}
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    Analytics
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/ai-lab/admin/pipelines/editor?id=${pipeline.id}`)}
                  >
                    <Workflow className="h-4 w-4 mr-1" />
                    Editar Visual
                  </Button>
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
                  {formData.steps && formData.steps.length > 0 ? (
                    formData.steps.map((step, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                        <Badge variant="secondary" className="mt-2">
                          #{step.order}
                        </Badge>
                        <Select
                          value={step.agent_id || undefined}
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
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhuma etapa configurada.</p>
                      <p className="text-sm mt-2">Clique em "+ Adicionar Etapa" para começar.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label htmlFor="active">Pipeline ativo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="draft"
                    checked={formData.draft}
                    onCheckedChange={(checked) => setFormData({ ...formData, draft: checked })}
                  />
                  <Label htmlFor="draft">Modo rascunho (teste antes de publicar)</Label>
                </div>
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

        {testingPipeline && (
          <PipelineTester
            pipelineId={testingPipeline.id!}
            pipelineName={testingPipeline.name}
            open={!!testingPipeline}
            onOpenChange={(open) => !open && setTestingPipeline(null)}
            onTestSuccess={() => {
              fetchPipelines() // Atualizar lista para mostrar last_tested_at
            }}
          />
        )}

        {debugPipeline && (
          <Dialog open={!!debugPipeline} onOpenChange={(open) => !open && setDebugPipeline(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Debug Mode - {debugPipeline.name}</DialogTitle>
              </DialogHeader>
              <DebugModePanel
                pipelineId={debugPipeline.id!}
                inputMessages={[{ role: 'user', content: 'Teste de debug' }]}
              />
            </DialogContent>
          </Dialog>
        )}

        {versionsPipeline && (
          <Dialog open={!!versionsPipeline} onOpenChange={(open) => !open && setVersionsPipeline(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <PipelineVersionsPanel
                pipelineId={versionsPipeline.id!}
                pipelineName={versionsPipeline.name}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
