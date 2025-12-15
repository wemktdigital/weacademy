'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  FlaskConical, 
  Play, 
  Pause, 
  CheckCircle2, 
  XCircle, 
  TrendingUp,
  BarChart3,
  Loader2,
  Plus,
  Eye,
  Target,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'

interface ABExperiment {
  id: string
  name: string
  description?: string
  variant_a_pipeline_id: string
  variant_a_version?: string
  variant_b_pipeline_id: string
  variant_b_version?: string
  traffic_split: { a: number; b: number }
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
  created_at: string
  started_at?: string
  completed_at?: string
  winner_variant?: 'a' | 'b' | 'tie' | 'none'
  conclusion?: string
  metrics?: {
    variantA: any
    variantB: any
  }
  analysis?: {
    recommendation: 'a' | 'b' | 'tie'
    confidence_level: number
    significant_difference: boolean
  }
}

interface Pipeline {
  id: string
  name: string
}

export default function ABExperimentsPage() {
  const [experiments, setExperiments] = useState<ABExperiment[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExperiment, setSelectedExperiment] = useState<ABExperiment | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    variant_a_pipeline_id: '',
    variant_a_version: '',
    variant_b_pipeline_id: '',
    variant_b_version: '',
    traffic_split_a: 50,
    traffic_split_b: 50,
    min_sample_size: 100,
    max_duration_days: 30,
    randomization_strategy: 'random' as 'random' | 'user_id_hash' | 'session_id',
  })

  useEffect(() => {
    fetchExperiments()
    fetchPipelines()
  }, [])

  const fetchExperiments = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/pipelines/ab-experiments', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar experimentos')
      }

      const data = await response.json()
      setExperiments(data.experiments || [])
    } catch (error: any) {
      console.error('Erro ao buscar experimentos:', error)
      toast.error(error.message || 'Erro ao buscar experimentos')
    } finally {
      setLoading(false)
    }
  }

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/pipelines')
      if (!response.ok) throw new Error('Erro ao buscar pipelines')
      const data = await response.json()
      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Erro ao buscar pipelines:', error)
    }
  }

  const handleCreateExperiment = async () => {
    if (!formData.name || !formData.variant_a_pipeline_id || !formData.variant_b_pipeline_id) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (formData.traffic_split_a + formData.traffic_split_b !== 100) {
      toast.error('A distribuição de tráfego deve somar 100%')
      return
    }

    setCreating(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/pipelines/ab-experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          variant_a_pipeline_id: formData.variant_a_pipeline_id,
          variant_a_version: formData.variant_a_version || undefined,
          variant_b_pipeline_id: formData.variant_b_pipeline_id,
          variant_b_version: formData.variant_b_version || undefined,
          traffic_split: {
            a: formData.traffic_split_a,
            b: formData.traffic_split_b,
          },
          min_sample_size: formData.min_sample_size,
          max_duration_days: formData.max_duration_days,
          randomization_strategy: formData.randomization_strategy,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar experimento')
      }

      toast.success('Experimento criado com sucesso!')
      setShowCreateDialog(false)
      setFormData({
        name: '',
        description: '',
        variant_a_pipeline_id: '',
        variant_a_version: '',
        variant_b_pipeline_id: '',
        variant_b_version: '',
        traffic_split_a: 50,
        traffic_split_b: 50,
        min_sample_size: 100,
        max_duration_days: 30,
        randomization_strategy: 'random',
      })
      fetchExperiments()
    } catch (error: any) {
      console.error('Erro ao criar experimento:', error)
      toast.error(error.message || 'Erro ao criar experimento')
    } finally {
      setCreating(false)
    }
  }

  const handleAction = async (experimentId: string, action: 'start' | 'pause' | 'complete', winnerVariant?: 'a' | 'b' | 'tie') => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines/ab-experiments/${experimentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action,
          winner_variant: winnerVariant,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao executar ação')
      }

      toast.success(`Experimento ${action === 'start' ? 'iniciado' : action === 'pause' ? 'pausado' : 'completado'}!`)
      fetchExperiments()
    } catch (error: any) {
      console.error('Erro ao executar ação:', error)
      toast.error(error.message || 'Erro ao executar ação')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing de Pipelines</h1>
          <p className="text-muted-foreground mt-1">
            Compare diferentes versões de pipelines para otimização baseada em dados
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/ai-lab/admin/pipelines">
            <Button variant="outline">Voltar</Button>
          </Link>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Experimento
          </Button>
        </div>
      </div>

      {experiments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhum experimento criado ainda</p>
            <p className="text-sm text-muted-foreground mt-2">
              Crie um experimento A/B para comparar diferentes versões de pipelines
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Experimento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {experiments.map((experiment) => {
            const variantAPipeline = pipelines.find(p => p.id === experiment.variant_a_pipeline_id)
            const variantBPipeline = pipelines.find(p => p.id === experiment.variant_b_pipeline_id)

            return (
              <Card key={experiment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5" />
                        {experiment.name}
                      </CardTitle>
                      {experiment.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {experiment.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        experiment.status === 'running'
                          ? 'default'
                          : experiment.status === 'completed'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {experiment.status === 'running'
                        ? 'Rodando'
                        : experiment.status === 'completed'
                        ? 'Completo'
                        : experiment.status === 'paused'
                        ? 'Pausado'
                        : experiment.status === 'draft'
                        ? 'Rascunho'
                        : 'Cancelado'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Variante A</Label>
                      <p className="font-semibold">
                        {variantAPipeline?.name || experiment.variant_a_pipeline_id}
                      </p>
                      {experiment.variant_a_version && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {experiment.variant_a_version}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {experiment.traffic_split.a}% do tráfego
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Variante B</Label>
                      <p className="font-semibold">
                        {variantBPipeline?.name || experiment.variant_b_pipeline_id}
                      </p>
                      {experiment.variant_b_version && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {experiment.variant_b_version}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {experiment.traffic_split.b}% do tráfego
                      </p>
                    </div>
                  </div>

                  {/* Métricas se estiver rodando */}
                  {experiment.status === 'running' && experiment.metrics && (
                    <div className="border-t pt-4 mb-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Execuções A</Label>
                          <p className="font-semibold">
                            {experiment.metrics.variantA?.total_executions || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Custo médio: ${experiment.metrics.variantA?.avg_cost_usd?.toFixed(4) || '0.0000'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Execuções B</Label>
                          <p className="font-semibold">
                            {experiment.metrics.variantB?.total_executions || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Custo médio: ${experiment.metrics.variantB?.avg_cost_usd?.toFixed(4) || '0.0000'}
                          </p>
                        </div>
                        {experiment.analysis && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Recomendação</Label>
                            <p className="font-semibold flex items-center gap-1">
                              Variante {experiment.analysis.recommendation.toUpperCase()}
                              {experiment.analysis.significant_difference && (
                                <Badge variant="default" className="text-xs">
                                  {(experiment.analysis.confidence_level * 100).toFixed(0)}% confiança
                                </Badge>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Resultado se completo */}
                  {experiment.status === 'completed' && experiment.winner_variant && (
                    <div className="border-t pt-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span className="font-semibold">Vencedor: Variante {experiment.winner_variant.toUpperCase()}</span>
                      </div>
                      {experiment.conclusion && (
                        <p className="text-sm text-muted-foreground mt-2">{experiment.conclusion}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedExperiment(experiment)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Detalhes
                    </Button>
                    {experiment.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(experiment.id, 'start')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {experiment.status === 'running' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(experiment.id, 'pause')}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pausar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (experiment.analysis?.recommendation) {
                              handleAction(experiment.id, 'complete', experiment.analysis.recommendation)
                            } else {
                              // Prompt para escolher vencedor
                              const winner = prompt('Escolha o vencedor (a ou b):')
                              if (winner && ['a', 'b', 'tie'].includes(winner)) {
                                handleAction(experiment.id, 'complete', winner as 'a' | 'b' | 'tie')
                              }
                            }
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Completar
                        </Button>
                      </>
                    )}
                    {experiment.status === 'paused' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(experiment.id, 'start')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Retomar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog para criar experimento */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Experimento A/B</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Experimento *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Comparar v1.0 vs v1.1"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o objetivo do experimento..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Variante A - Pipeline *</Label>
                <Select
                  value={formData.variant_a_pipeline_id}
                  onValueChange={(value) => setFormData({ ...formData, variant_a_pipeline_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Versão (opcional, ex: v1.0.0)"
                  value={formData.variant_a_version}
                  onChange={(e) => setFormData({ ...formData, variant_a_version: e.target.value })}
                />
              </div>
              <div>
                <Label>Variante B - Pipeline *</Label>
                <Select
                  value={formData.variant_b_pipeline_id}
                  onValueChange={(value) => setFormData({ ...formData, variant_b_pipeline_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Versão (opcional, ex: v1.1.0)"
                  value={formData.variant_b_version}
                  onChange={(e) => setFormData({ ...formData, variant_b_version: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Distribuição de Tráfego - Variante A (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.traffic_split_a}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    setFormData({
                      ...formData,
                      traffic_split_a: value,
                      traffic_split_b: 100 - value,
                    })
                  }}
                />
              </div>
              <div>
                <Label>Distribuição de Tráfego - Variante B (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.traffic_split_b}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    setFormData({
                      ...formData,
                      traffic_split_a: 100 - value,
                      traffic_split_b: value,
                    })
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {formData.traffic_split_a + formData.traffic_split_b}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tamanho Mínimo de Amostra</Label>
                <Input
                  type="number"
                  min="10"
                  value={formData.min_sample_size}
                  onChange={(e) => setFormData({ ...formData, min_sample_size: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div>
                <Label>Duração Máxima (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_duration_days}
                  onChange={(e) => setFormData({ ...formData, max_duration_days: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div>
                <Label>Estratégia de Randomização</Label>
                <Select
                  value={formData.randomization_strategy}
                  onValueChange={(value: 'random' | 'user_id_hash' | 'session_id') =>
                    setFormData({ ...formData, randomization_strategy: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Aleatório</SelectItem>
                    <SelectItem value="user_id_hash">Hash por Usuário</SelectItem>
                    <SelectItem value="session_id">Hash por Sessão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateExperiment} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Experimento'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver detalhes */}
      {selectedExperiment && (
        <Dialog open={!!selectedExperiment} onOpenChange={() => setSelectedExperiment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedExperiment.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedExperiment.description && (
                <div>
                  <Label>Descrição</Label>
                  <p className="text-sm">{selectedExperiment.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Variante A</Label>
                  <p className="font-semibold">
                    {pipelines.find(p => p.id === selectedExperiment.variant_a_pipeline_id)?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedExperiment.traffic_split.a}% do tráfego
                  </p>
                </div>
                <div>
                  <Label>Variante B</Label>
                  <p className="font-semibold">
                    {pipelines.find(p => p.id === selectedExperiment.variant_b_pipeline_id)?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedExperiment.traffic_split.b}% do tráfego
                  </p>
                </div>
              </div>
              {selectedExperiment.metrics && (
                <div className="border-t pt-4">
                  <Label>Métricas</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-muted p-3 rounded">
                      <Label className="text-xs">Variante A</Label>
                      <div className="text-sm space-y-1 mt-2">
                        <p>Execuções: {selectedExperiment.metrics.variantA?.total_executions || 0}</p>
                        <p>Custo médio: ${selectedExperiment.metrics.variantA?.avg_cost_usd?.toFixed(4) || '0.0000'}</p>
                        <p>Latência média: {selectedExperiment.metrics.variantA?.avg_latency_ms?.toFixed(0) || '0'}ms</p>
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <Label className="text-xs">Variante B</Label>
                      <div className="text-sm space-y-1 mt-2">
                        <p>Execuções: {selectedExperiment.metrics.variantB?.total_executions || 0}</p>
                        <p>Custo médio: ${selectedExperiment.metrics.variantB?.avg_cost_usd?.toFixed(4) || '0.0000'}</p>
                        <p>Latência média: {selectedExperiment.metrics.variantB?.avg_latency_ms?.toFixed(0) || '0'}ms</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {selectedExperiment.analysis && (
                <div className="border-t pt-4">
                  <Label>Análise</Label>
                  <div className="mt-2 p-3 bg-primary/10 rounded">
                    <p className="font-semibold">
                      Recomendação: Variante {selectedExperiment.analysis.recommendation.toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Confiança: {(selectedExperiment.analysis.confidence_level * 100).toFixed(0)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Diferença significativa: {selectedExperiment.analysis.significant_difference ? 'Sim' : 'Não'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

