'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  BarChart3,
  Gauge,
  Activity,
  Hourglass,
  DollarSign,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

interface ModelPreference {
  provider: string
  model: string
  count: number
}

interface ModelInsightResponse {
  provider: string
  model: string
  successRate: number
  avgLatency: number
  avgCost: number
  executions: number
  avgQualityScore?: number
  categories: string[]
  insights?: string[]
}

interface CategoryInsightResponse {
  category: string
  executions: number
  successRate: number
  avgLatency: number
  avgCost: number
  topModel?: {
    provider: string
    model: string
    successRate: number
  }
}

interface RoutingAnalyticsResponse {
  summary: {
    totalExecutions: number
    recentExecutions: number
    monitoredModels: number
    uniqueCategories: number
    avgLatency: number
    avgCost: number
    successRate: number
  }
  improvements: {
    costSavingsPerExecution?: number
    latencyImprovementMs?: number
    successImprovement?: number
    bestCostModel?: { provider: string; model: string; avgCost: number }
    bestLatencyModel?: { provider: string; model: string; avgLatency: number }
    bestSuccessModel?: { provider: string; model: string; successRate: number }
  }
  topModels: ModelInsightResponse[]
  underperformingModels: ModelInsightResponse[]
  categoryInsights: CategoryInsightResponse[]
  recommendations: {
    acceptedCount: number
    categories: Array<{ category: string; count: number }>
    topReasons: string[]
  }
  preferences: {
    topPreferredModels: ModelPreference[]
    avoidedModels: Array<{ provider: string; model: string; reason: string }>
  }
  feedback: {
    total: number
    positive: number
    negative: number
    positiveRatio: number
    recentComments: Array<{ provider: string; model: string; rating: number; comment?: string; created_at: string }>
  }
}

function formatNumber(value: number, fractionDigits = 1) {
  if (Number.isNaN(value)) return '-'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function getModelDisplayData(provider: string, model: string) {
  const found = AVAILABLE_MODELS.find(item => item.provider === provider && item.model === model)
  return {
    name: found?.displayName || model,
    icon: found?.icon || '🤖',
  }
}

export default function RoutingAnalyticsDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<RoutingAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadAnalytics()
    }
  }, [user])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/routing/analytics', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar analytics')
      }

      const data = await response.json()
      setAnalytics(data.analytics)
    } catch (error: any) {
      console.error('[Routing][Dashboard] Erro ao carregar analytics:', error)
      toast({
        title: 'Erro ao carregar dashboard',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const summaryCards = useMemo(() => {
    if (!analytics) return []

    return [
      {
        label: 'Execuções Monitoradas',
        value: analytics.summary.totalExecutions.toLocaleString('pt-BR'),
        description: `${analytics.summary.recentExecutions.toLocaleString('pt-BR')} nos últimos 7 dias`,
        icon: Gauge,
      },
      {
        label: 'Taxa de Sucesso',
        value: `${formatNumber(analytics.summary.successRate)}%`,
        description: 'Execuções concluídas sem erro',
        icon: Activity,
      },
      {
        label: 'Latência Média',
        value: `${formatNumber(analytics.summary.avgLatency, 0)} ms`,
        description: 'Tempo desde a chamada até a resposta',
        icon: Hourglass,
      },
      {
        label: 'Custo Médio',
        value: `$${formatNumber(analytics.summary.avgCost, 4)}`,
        description: 'Por execução registrada',
        icon: DollarSign,
      },
    ]
  }, [analytics])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Autenticação necessária</CardTitle>
            <CardDescription>Faça login para ver o dashboard de otimização.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 max-w-6xl">
        <div className="mb-6">
          <Link href="/ai-lab">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Chat
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Analytics de Routing Inteligente</h1>
              <p className="text-muted-foreground">
                Acompanhe ganhos de performance, custo e confiabilidade gerados pelo roteamento automático
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Carregando insights...</p>
          </div>
        ) : !analytics ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Sem dados suficientes</h3>
              <p className="text-muted-foreground">
                Execute alguns fluxos com routing inteligente para gerar métricas de otimização.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map(card => {
                  const Icon = card.icon
                  return (
                    <Card key={card.label}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {card.label}
                        </CardTitle>
                        <Icon className="h-5 w-5 text-primary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                        <p className="text-xs text-muted-foreground">{card.description}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Ganho estimado por execução</CardTitle>
                      <CardDescription>
                        Comparativo entre média geral e melhor modelo identificado pelo routing
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Economia média</p>
                      <p className="text-2xl font-semibold">
                        {analytics.improvements.costSavingsPerExecution
                          ? `$${formatNumber(analytics.improvements.costSavingsPerExecution, 4)}`
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {analytics.improvements.bestCostModel
                          ? `Melhor custo: ${getModelDisplayData(
                              analytics.improvements.bestCostModel.provider,
                              analytics.improvements.bestCostModel.model
                            ).name}`
                          : 'Aguardando mais dados'}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Latência reduzida</p>
                      <p className="text-2xl font-semibold">
                        {analytics.improvements.latencyImprovementMs
                          ? `${formatNumber(analytics.improvements.latencyImprovementMs, 0)} ms`
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {analytics.improvements.bestLatencyModel
                          ? `Mais rápido: ${getModelDisplayData(
                              analytics.improvements.bestLatencyModel.provider,
                              analytics.improvements.bestLatencyModel.model
                            ).name}`
                          : 'Aguardando mais dados'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Confiabilidade</p>
                      <p className="text-2xl font-semibold">
                        {analytics.improvements.successImprovement
                          ? `${formatNumber(analytics.improvements.successImprovement)}%`
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {analytics.improvements.bestSuccessModel
                          ? `Maior sucesso: ${getModelDisplayData(
                              analytics.improvements.bestSuccessModel.provider,
                              analytics.improvements.bestSuccessModel.model
                            ).name}`
                          : 'Aguardando mais dados'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Recomendações Aceitas</CardTitle>
                      <CardDescription>
                        Como o routing inteligente está sendo adotado no dia a dia
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Total aceito</p>
                      <p className="text-2xl font-semibold">
                        {analytics.recommendations.acceptedCount.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {analytics.summary.totalExecutions > 0
                        ? `${formatNumber(
                            (analytics.recommendations.acceptedCount / analytics.summary.totalExecutions) * 100
                          )}% das execuções`
                        : 'Sem execuções'}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs uppercase text-muted-foreground">Principais categorias</p>
                    {analytics.recommendations.categories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma aceitação registrada ainda.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {analytics.recommendations.categories.map(item => (
                          <Badge key={item.category} variant="outline">
                            {item.category} · {item.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {analytics.recommendations.topReasons.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase text-muted-foreground">Motivos recorrentes</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {analytics.recommendations.topReasons.map(reason => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Modelos com melhor performance</CardTitle>
                  <CardDescription>Top 5 modelos que entregam melhor custo/qualidade</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analytics.topModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Insira mais execuções para rankear os modelos.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.topModels.map(model => {
                        const display = getModelDisplayData(model.provider, model.model)
                        return (
                          <div key={`${model.provider}:${model.model}`} className="flex items-start justify-between rounded-lg border p-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span>{display.icon}</span>
                                <span className="font-semibold">{display.name}</span>
                                <Badge variant="outline">{model.executions} execs</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Categorias: {model.categories.join(', ')}
                              </p>
                            </div>
                            <div className="space-y-1 text-right">
                              <p className="text-sm">Sucesso: {formatNumber(model.successRate)}%</p>
                              <p className="text-sm">Latência: {formatNumber(model.avgLatency, 0)} ms</p>
                              <p className="text-sm">Custo: ${formatNumber(model.avgCost, 4)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Modelos que merecem atenção</CardTitle>
                  <CardDescription>Entrada para ajustes de preferências ou bloqueios</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analytics.underperformingModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum modelo com problemas relevantes até agora.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.underperformingModels.map(model => {
                        const display = getModelDisplayData(model.provider, model.model)
                        return (
                          <div key={`${model.provider}:${model.model}`} className="rounded-lg border p-4">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                              <span className="font-semibold">{display.name}</span>
                              <Badge variant="secondary">{model.executions} execs</Badge>
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground space-y-1">
                              <p>Sucesso: {formatNumber(model.successRate)}%</p>
                              <p>Latência: {formatNumber(model.avgLatency, 0)} ms · Custo: ${formatNumber(model.avgCost, 4)}</p>
                              {model.insights && (
                                <ul className="list-disc pl-5">
                                  {model.insights.map(insight => (
                                    <li key={insight}>{insight}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Insights por categoria de tarefa</CardTitle>
                  <CardDescription>Descubra quais modelos funcionam melhor em cada contexto</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.categoryInsights.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ainda não há dados suficientes por categoria.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {analytics.categoryInsights.map(category => (
                        <div key={category.category} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold capitalize">{category.category}</h3>
                            <Badge variant="outline">{category.executions} execs</Badge>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                            <p>Sucesso médio: {formatNumber(category.successRate)}%</p>
                            <p>Latência média: {formatNumber(category.avgLatency, 0)} ms</p>
                            <p>Custo médio: ${formatNumber(category.avgCost, 4)}</p>
                          </div>
                          {category.topModel && (
                            <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
                              <p className="font-semibold text-foreground">Melhor modelo sugerido</p>
                              <p className="text-muted-foreground">
                                {getModelDisplayData(category.topModel.provider, category.topModel.model).name}
                                {' · '}
                                {formatNumber(category.topModel.successRate)}% de sucesso
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Preferências aprendidas</CardTitle>
                  <CardDescription>Modelos preferidos pelo seu time e alertas para evitar</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase text-muted-foreground">Top modelos aceitos</p>
                    {analytics.preferences.topPreferredModels.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">Aceite recomendações para construir histórico.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {analytics.preferences.topPreferredModels.map(item => {
                          const display = getModelDisplayData(item.provider, item.model)
                          return (
                            <li key={`${item.provider}:${item.model}`} className="flex items-center justify-between">
                              <span>
                                <span className="mr-2">{display.icon}</span>
                                {display.name}
                              </span>
                              <Badge variant="secondary">{item.count}x</Badge>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase text-muted-foreground">Modelos a monitorar</p>
                    {analytics.preferences.avoidedModels.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">Nenhum alerta até agora.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {analytics.preferences.avoidedModels.map(item => {
                          const display = getModelDisplayData(item.provider, item.model)
                          return (
                            <li key={`${item.provider}:${item.model}`}>
                              <span className="font-medium text-foreground">{display.name}</span>
                              <span className="block text-xs">{item.reason}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Feedback da equipe</CardTitle>
                  <CardDescription>Como os usuários avaliam as recomendações automáticas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Total de feedbacks</p>
                      <p className="text-2xl font-semibold">{analytics.feedback.total.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Feedback positivo</p>
                      <p className="text-2xl font-semibold text-emerald-600">
                        {analytics.feedback.positive.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Feedback negativo</p>
                      <p className="text-2xl font-semibold text-destructive">
                        {analytics.feedback.negative.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase text-muted-foreground">Índice de aprovação</p>
                      <p className="text-2xl font-semibold">
                        {analytics.feedback.total > 0 ? `${formatNumber(analytics.feedback.positiveRatio)}%` : '—'}
                      </p>
                    </div>
                  </div>

                  {analytics.feedback.recentComments.length > 0 && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-2">Comentários recentes</p>
                      <div className="space-y-2">
                        {analytics.feedback.recentComments.map((item, index) => {
                          const display = getModelDisplayData(item.provider, item.model)
                          return (
                            <div
                              key={`${item.provider}:${item.model}:${index}`}
                              className="rounded-lg border p-3 text-sm bg-muted/40"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{display.icon}</span>
                                  <span className="font-medium">{display.name}</span>
                                </div>
                                <Badge variant={item.rating > 0 ? 'secondary' : 'destructive'}>
                                  {item.rating > 0 ? 'Positivo' : 'Negativo'}
                                </Badge>
                              </div>
                              {item.comment && (
                                <p className="mt-2 text-muted-foreground">“{item.comment}”</p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
