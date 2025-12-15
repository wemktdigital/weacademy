'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  Target,
  Loader2,
  RefreshCw,
  Lightbulb,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'

interface AnalyticsData {
  patterns?: {
    patterns: any[]
    bottlenecks: any[]
    optimizations: any[]
    insights: any[]
  }
  bottlenecks?: any[]
  anomalies?: any[]
  optimizations?: any[]
}

interface Alert {
  id: string
  alert_type: string
  title: string
  message: string
  severity: string
  status: string
  triggered_at: string
  difference_percent?: number
}

export default function PipelineAnalyticsPage() {
  const params = useParams()
  const pipelineId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [pipeline, setPipeline] = useState<any>(null)
  const [periodDays, setPeriodDays] = useState(7)

  useEffect(() => {
    fetchPipeline()
    fetchAnalytics()
    fetchAlerts()
  }, [pipelineId, periodDays])

  const fetchPipeline = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })

      if (!response.ok) throw new Error('Erro ao buscar pipeline')
      const data = await response.json()
      setPipeline(data.pipeline)
    } catch (error: any) {
      console.error('Erro ao buscar pipeline:', error)
      toast.error(error.message || 'Erro ao buscar pipeline')
    }
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/${pipelineId}/analytics?period_days=${periodDays}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })

      if (!response.ok) throw new Error('Erro ao buscar analytics')
      const data = await response.json()
      setAnalytics(data.analytics)
    } catch (error: any) {
      console.error('Erro ao buscar analytics:', error)
      toast.error(error.message || 'Erro ao buscar analytics')
    } finally {
      setLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/${pipelineId}/alerts`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })

      if (!response.ok) throw new Error('Erro ao buscar alertas')
      const data = await response.json()
      setAlerts(data.alerts || [])
    } catch (error: any) {
      console.error('Erro ao buscar alertas:', error)
    }
  }

  const handleGenerateInsights = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/${pipelineId}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ period_days: periodDays }),
      })

      if (!response.ok) throw new Error('Erro ao gerar insights')
      
      toast.success('Insights gerados com sucesso!')
      fetchAnalytics()
      fetchAlerts()
    } catch (error: any) {
      console.error('Erro ao gerar insights:', error)
      toast.error(error.message || 'Erro ao gerar insights')
    }
  }

  const handleUpdateAlertStatus = async (alertId: string, status: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/${pipelineId}/alerts/${alertId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) throw new Error('Erro ao atualizar alerta')
      
      toast.success('Alerta atualizado!')
      fetchAlerts()
    } catch (error: any) {
      console.error('Erro ao atualizar alerta:', error)
      toast.error(error.message || 'Erro ao atualizar alerta')
    }
  }

  if (loading && !analytics) {
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
          <h1 className="text-3xl font-bold">Analytics Avançados</h1>
          <p className="text-muted-foreground mt-1">
            {pipeline?.name || 'Pipeline'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/ai-lab/admin/pipelines">
            <Button variant="outline">Voltar</Button>
          </Link>
          <Button onClick={handleGenerateInsights} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Insights
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filtro de período */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Período:</span>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(parseInt(e.target.value))}
              className="px-3 py-1 border rounded-md"
            >
              <option value={1}>Último dia</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alertas Proativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts
                .filter(a => a.status === 'active')
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : alert.severity === 'high'
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={
                              alert.severity === 'critical'
                                ? 'destructive'
                                : alert.severity === 'high'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {alert.severity}
                          </Badge>
                          <span className="font-semibold">{alert.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        {alert.difference_percent && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Diferença: {Math.abs(alert.difference_percent).toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateAlertStatus(alert.id, 'acknowledged')}
                        >
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateAlertStatus(alert.id, 'dismissed')}
                        >
                          Dispensar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Analytics */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="bottlenecks">Gargalos</TabsTrigger>
          <TabsTrigger value="optimizations">Otimizações</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalias</TabsTrigger>
        </TabsList>

        {/* Insights */}
        <TabsContent value="insights" className="space-y-4">
          {analytics?.patterns?.insights && analytics.patterns.insights.length > 0 ? (
            <div className="grid gap-4">
              {analytics.patterns.insights.map((insight: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5" />
                        {insight.title || `Insight ${index + 1}`}
                      </CardTitle>
                      <Badge
                        variant={
                          insight.severity === 'critical'
                            ? 'destructive'
                            : insight.severity === 'high'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {insight.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{insight.description}</p>
                    {insight.recommendations && insight.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Recomendações:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {insight.recommendations.map((rec: string, i: number) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {insight.estimated_impact && (
                      <div className="mt-4 p-3 bg-muted rounded">
                        <p className="text-xs font-semibold mb-1">Impacto Estimado:</p>
                        {insight.estimated_impact.cost_savings && (
                          <p className="text-xs">
                            Economia de custo: {insight.estimated_impact.cost_savings.toFixed(2)}%
                          </p>
                        )}
                        {insight.estimated_impact.latency_reduction && (
                          <p className="text-xs">
                            Redução de latência: {insight.estimated_impact.latency_reduction}ms
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhum insight disponível</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Clique em "Gerar Insights" para analisar padrões e gerar recomendações
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Gargalos */}
        <TabsContent value="bottlenecks" className="space-y-4">
          {analytics?.bottlenecks && analytics.bottlenecks.length > 0 ? (
            <div className="grid gap-4">
              {analytics.bottlenecks.map((bottleneck: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Gargalo no Step {bottleneck.step_order}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Latência Média</p>
                        <p className="font-semibold">
                          {bottleneck.avg_latency_ms?.toFixed(0) || '0'}ms
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Impacto: {bottleneck.impact_on_total_latency_percent?.toFixed(0) || '0'}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Custo Médio</p>
                        <p className="font-semibold">
                          ${bottleneck.avg_cost_usd?.toFixed(6) || '0.000000'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Impacto: {bottleneck.impact_on_total_cost_percent?.toFixed(0) || '0'}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhum gargalo detectado</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Otimizações */}
        <TabsContent value="optimizations" className="space-y-4">
          {analytics?.optimizations && analytics.optimizations.length > 0 ? (
            <div className="grid gap-4">
              {analytics.optimizations.map((opt: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        {opt.title || `Otimização ${index + 1}`}
                      </CardTitle>
                      <Badge variant={opt.status === 'applied' ? 'default' : 'outline'}>
                        {opt.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{opt.description}</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {opt.estimated_cost_savings_percent && (
                        <div>
                          <p className="text-xs text-muted-foreground">Economia Estimada</p>
                          <p className="font-semibold text-green-600">
                            {opt.estimated_cost_savings_percent.toFixed(1)}%
                          </p>
                        </div>
                      )}
                      {opt.estimated_latency_reduction_ms && (
                        <div>
                          <p className="text-xs text-muted-foreground">Redução de Latência</p>
                          <p className="font-semibold text-blue-600">
                            {opt.estimated_latency_reduction_ms}ms
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Confiança</p>
                        <p className="font-semibold">
                          {(opt.confidence_level * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhuma otimização recomendada</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Anomalias */}
        <TabsContent value="anomalies" className="space-y-4">
          {analytics?.anomalies && analytics.anomalies.length > 0 ? (
            <div className="grid gap-4">
              {analytics.anomalies.map((anomaly: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Anomalia em {anomaly.anomaly_date}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Custo Real</p>
                        <p className="font-semibold">${anomaly.avg_cost?.toFixed(6) || '0.000000'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Custo Esperado</p>
                        <p className="font-semibold">${anomaly.expected_cost?.toFixed(6) || '0.000000'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Diferença</p>
                        <p className={`font-semibold ${
                          anomaly.difference_percent > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {anomaly.difference_percent?.toFixed(0) || '0'}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhuma anomalia detectada</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

