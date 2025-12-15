'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CostAnalytics {
  total_cost_usd: number
  total_executions: number
  avg_cost_per_execution: number
  cost_trend: Array<{
    date: string
    cost: number
    executions: number
  }>
  accuracy: {
    average: number
    count: number
  }
  savings_potential: number
}

export default function CostAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CostAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('all')
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchPipelines()
    fetchAnalytics()
  }, [selectedPipelineId])

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/pipelines')
      if (!response.ok) throw new Error('Failed to fetch pipelines')
      const data = await response.json()
      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      let query = serviceSupabase
        .from('lab_pipeline_logs')
        .select('total_cost_usd, total_latency_ms, created_at, pipeline_id')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (selectedPipelineId !== 'all') {
        query = query.eq('pipeline_id', selectedPipelineId)
      }

      const { data: logs } = await query

      // Buscar precisão de estimativas
      let accuracyQuery = serviceSupabase
        .from('lab_pipeline_cost_estimates')
        .select('cost_difference_percent')
        .not('cost_difference_percent', 'is', null)
        .limit(100)

      if (selectedPipelineId !== 'all') {
        accuracyQuery = accuracyQuery.eq('pipeline_id', selectedPipelineId)
      }

      const { data: estimates } = await accuracyQuery

      // Processar dados
      const totalCost = (logs || []).reduce((sum, log) => sum + parseFloat(log.total_cost_usd || '0'), 0)
      const totalExecutions = logs?.length || 0
      const avgCost = totalExecutions > 0 ? totalCost / totalExecutions : 0

      // Agrupar por data
      const costByDate = new Map<string, { cost: number; executions: number }>()
      logs?.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0]
        const current = costByDate.get(date) || { cost: 0, executions: 0 }
        costByDate.set(date, {
          cost: current.cost + parseFloat(log.total_cost_usd || '0'),
          executions: current.executions + 1,
        })
      })

      const costTrend = Array.from(costByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30) // Últimos 30 dias

      // Calcular precisão média
      const accuracyValues = (estimates || [])
        .map(e => Math.abs(e.cost_difference_percent || 0))
        .filter(v => !isNaN(v))
      
      const avgAccuracy = accuracyValues.length > 0
        ? 100 - (accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length)
        : 0

      setAnalytics({
        total_cost_usd: totalCost,
        total_executions: totalExecutions,
        avg_cost_per_execution: avgCost,
        cost_trend: costTrend,
        accuracy: {
          average: avgAccuracy,
          count: accuracyValues.length,
        },
        savings_potential: 0, // Calcular baseado em sugestões
      })
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando analytics...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics de Custo</h1>
          <p className="text-muted-foreground mt-1">
            Análise de custos e economia de pipelines
          </p>
        </div>
        <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Pipelines</SelectItem>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {analytics && (
        <>
          {/* Métricas principais */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Custo Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  ${analytics.total_cost_usd.toFixed(4)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Execuções
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.total_executions}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Custo Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${analytics.avg_cost_per_execution.toFixed(4)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Precisão Estimativa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {analytics.accuracy.average > 80 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : analytics.accuracy.average > 60 ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  {analytics.accuracy.average.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analytics.accuracy.count} comparações
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de tendência */}
          <Card>
            <CardHeader>
              <CardTitle>Tendência de Custo (Últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.cost_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#29CEDF"
                    name="Custo (USD)"
                  />
                  <Line
                    type="monotone"
                    dataKey="executions"
                    stroke="#25D366"
                    name="Execuções"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {analytics.total_executions === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Nenhum dado disponível. Execute alguns pipelines para ver analytics.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

