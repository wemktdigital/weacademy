'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Clock,
  Loader2,
  BarChart2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface WorkflowMetricRow {
  metric_date: string
  workflow_version_id: string
  workflow_id: string
  total_runs: number
  completed_runs: number
  failed_runs: number
  cancelled_runs: number
  avg_latency_ms: number | null
  p50_latency_ms?: number | null
  max_latency_ms?: number | null
  avg_cost_usd: number | null
  total_cost_usd: number
}

interface StageMetricAggregate {
  stage_id: string
  stage_key?: string
  stage_name?: string | null
  stage_type?: string | null
  executions: number
  completed_executions: number
  failed_executions: number
  failure_rate: number
  total_cost_usd: number
  avg_latency_ms: number | null
}

interface MetricsSummary {
  totalRuns: number
  completedRuns: number
  failedRuns: number
  cancelledRuns: number
  successRate: number
  totalCostUsd: number
  avgCostUsd: number
  avgLatencyMs: number
}

interface WorkflowVersionOption {
  id: string
  version_label: string
  workflow_id: string
  workflow?: {
    id: string
    name: string
  }
}

interface WorkflowOption {
  id: string
  name: string
}

function formatCurrency(value: number, digits = 4) {
  return `$${value.toFixed(digits)}`
}

function formatPercentage(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}

function formatDuration(ms?: number | null) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.round((ms % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

const REQUIRED_ROLES = ['admin', 'gestor_we']

export default function WorkflowMetricsPage() {
  const router = useRouter()
  const { user } = useAuth()

  const today = useMemo(() => new Date(), [])
  const defaultFromDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date
  }, [])

  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [versionsLoaded, setVersionsLoaded] = useState(false)

  const [metrics, setMetrics] = useState<WorkflowMetricRow[]>([])
  const [stageMetrics, setStageMetrics] = useState<StageMetricAggregate[]>([])
  const [summary, setSummary] = useState<MetricsSummary | null>(null)

  const [workflowOptions, setWorkflowOptions] = useState<WorkflowOption[]>([])
  const [versionOptions, setVersionOptions] = useState<WorkflowVersionOption[]>([])

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('all')
  const [selectedVersionId, setSelectedVersionId] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: defaultFromDate.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  })

  const checkUserRole = useCallback(async () => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (!profile || !REQUIRED_ROLES.includes(profile.role)) {
        toast.error('Acesso negado. Apenas administradores podem acessar esta página.')
        router.push('/ai-lab')
        return
      }

      setCheckingRole(false)
    } catch (err) {
      console.error('[WorkflowMetrics] erro ao validar permissões:', err)
      toast.error('Erro ao verificar permissões de acesso')
      router.push('/ai-lab')
    }
  }, [router, user])

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch('/api/lab-ia/workflows/versions?limit=200')
      if (!response.ok) throw new Error('Erro ao carregar versões de workflow')
      const data = await response.json()
      const versions: WorkflowVersionOption[] = (data?.versions || []).map((version: any) => ({
        id: version.id,
        version_label: version.version_label,
        workflow_id: version.workflow_id,
        workflow: version.workflow,
      }))

      setVersionOptions(versions)

      const uniqueWorkflows = Array.from(
        new Map(
          versions
            .filter((v) => v.workflow_id)
            .map((v) => [
              v.workflow_id,
              {
                id: v.workflow_id,
                name: v.workflow?.name || 'Workflow sem nome',
              },
            ])
        ).values()
      )

      setWorkflowOptions(uniqueWorkflows)
    } catch (error) {
      console.error('[WorkflowMetrics] erro ao buscar versões:', error)
      toast.error('Não foi possível carregar as versões de workflow')
    } finally {
      setVersionsLoaded(true)
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    if (checkingRole || !versionsLoaded) return
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (selectedWorkflowId !== 'all') {
        params.set('workflow_id', selectedWorkflowId)
      }
      if (selectedVersionId !== 'all') {
        params.set('workflow_version_id', selectedVersionId)
      }
      if (dateRange.from) {
        params.set('from', dateRange.from)
      }
      if (dateRange.to) {
        params.set('to', dateRange.to)
      }

      const response = await fetch(`/api/lab-ia/admin/workflows/metrics?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao carregar métricas')
      const data = await response.json()

      setMetrics(data.metrics || [])
      setStageMetrics(data.stageMetrics || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error('[WorkflowMetrics] erro ao buscar métricas:', error)
      toast.error('Não foi possível carregar as métricas')
    } finally {
      setLoading(false)
    }
  }, [
    checkingRole,
    versionsLoaded,
    selectedWorkflowId,
    selectedVersionId,
    dateRange.from,
    dateRange.to,
  ])

  useEffect(() => {
    checkUserRole()
  }, [checkUserRole])

  useEffect(() => {
    if (!checkingRole) {
      fetchVersions()
    }
  }, [checkingRole, fetchVersions])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const filteredVersionOptions = useMemo(() => {
    if (selectedWorkflowId === 'all') return versionOptions
    return versionOptions.filter((version) => version.workflow_id === selectedWorkflowId)
  }, [selectedWorkflowId, versionOptions])

  const chartData = useMemo(() => {
    return metrics.map((row) => ({
      date: formatDateLabel(row.metric_date),
      totalRuns: row.total_runs || 0,
      completedRuns: row.completed_runs || 0,
      failedRuns: row.failed_runs || 0,
      totalCostUsd: Number(row.total_cost_usd || 0),
    }))
  }, [metrics])

  const topFailureStages = useMemo(() => {
    return [...stageMetrics]
      .sort((a, b) => (b.failure_rate || 0) - (a.failure_rate || 0))
      .slice(0, 5)
  }, [stageMetrics])

  const topCostStages = useMemo(() => {
    return [...stageMetrics]
      .sort((a, b) => (b.total_cost_usd || 0) - (a.total_cost_usd || 0))
      .slice(0, 5)
  }, [stageMetrics])

  const topLatencyStages = useMemo(() => {
    return [...stageMetrics]
      .filter((stage) => stage.avg_latency_ms != null)
      .sort((a, b) => (b.avg_latency_ms || 0) - (a.avg_latency_ms || 0))
      .slice(0, 5)
  }, [stageMetrics])

  const handleWorkflowChange = (value: string) => {
    setSelectedWorkflowId(value)
    setSelectedVersionId('all')
  }

  const handleVersionChange = (value: string) => {
    setSelectedVersionId(value)
  }

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }))
  }

  if (checkingRole) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Verificando permissões...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Observabilidade de Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe execuções, falhas, custos e gargalos das orquestrações end-to-end.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <Label>Workflow</Label>
            <Select value={selectedWorkflowId} onValueChange={handleWorkflowChange}>
              <SelectTrigger className="min-w-[220px]">
                <SelectValue placeholder="Selecione um workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Workflows</SelectItem>
                {workflowOptions.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Versão</Label>
            <Select value={selectedVersionId} onValueChange={handleVersionChange}>
              <SelectTrigger className="min-w-[220px]">
                <SelectValue placeholder="Selecione uma versão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Versões</SelectItem>
                {filteredVersionOptions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.version_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>De</Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(event) => handleDateChange('from', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Até</Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(event) => handleDateChange('to', event.target.value)}
              />
            </div>
          </div>

          <Button onClick={fetchMetrics} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </span>
            ) : (
              'Atualizar'
            )}
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Execuções Totais
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Activity className="h-10 w-10 text-primary" />
              <div>
                <div className="text-2xl font-bold">{summary.totalRuns}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.completedRuns} concluídas · {summary.failedRuns} falhas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold">{formatPercentage(summary.successRate)}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.failedRuns} falhas · {summary.cancelledRuns} cancelamentos
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo Total
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <DollarSign className="h-10 w-10 text-sky-500" />
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.totalCostUsd, summary.totalCostUsd > 1 ? 2 : 4)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Médio por execução: {formatCurrency(summary.avgCostUsd)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Latência Média
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Clock className="h-10 w-10 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{formatDuration(summary.avgLatencyMs)}</div>
                <p className="text-xs text-muted-foreground">
                  Pico diário registrado no período analisado
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma execução registrada no período selecionado.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Tendências de Execução e Custo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparativo diário de execuções, sucesso e custo agregado.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {chartData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" stroke="currentColor" className="text-xs text-muted-foreground" />
                  <YAxis
                    yAxisId="left"
                    stroke="currentColor"
                    className="text-xs text-muted-foreground"
                    tickFormatter={(value) => `${value}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="currentColor"
                    className="text-xs text-muted-foreground"
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalRuns"
                    stroke="hsl(var(--primary))"
                    name="Execuções"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="completedRuns"
                    stroke="hsl(var(--success))"
                    name="Concluídas"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="failedRuns"
                    stroke="hsl(var(--destructive))"
                    name="Falhas"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalCostUsd"
                    stroke="hsl(var(--secondary-foreground))"
                    name="Custo (USD)"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              Nenhum dado encontrado para gerar o gráfico.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Stages com maior taxa de falha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topFailureStages.length > 0 ? (
              topFailureStages.map((stage) => (
                <div
                  key={stage.stage_id}
                  className="flex items-center justify-between rounded-md border border-border/40 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {stage.stage_name || stage.stage_key || 'Stage'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="capitalize">
                        {stage.stage_type || 'stage'}
                      </Badge>
                      <span>{stage.executions} execuções</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-destructive">
                      {formatPercentage(stage.failure_rate, 1)}
                    </div>
                    <p className="text-xs text-muted-foreground">falha / execução</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma etapa registrada.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-sky-500" />
              Stages mais custosos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCostStages.length > 0 ? (
              topCostStages.map((stage) => (
                <div
                  key={stage.stage_id}
                  className="flex items-center justify-between rounded-md border border-border/40 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {stage.stage_name || stage.stage_key || 'Stage'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {stage.executions} execuções
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {formatCurrency(stage.total_cost_usd, stage.total_cost_usd > 1 ? 2 : 4)}
                    </div>
                    <p className="text-xs text-muted-foreground">custo acumulado</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum custo registrado.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Stages mais lentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topLatencyStages.length > 0 ? (
              topLatencyStages.map((stage) => (
                <div
                  key={stage.stage_id}
                  className="flex items-center justify-between rounded-md border border-border/40 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {stage.stage_name || stage.stage_key || 'Stage'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {stage.executions} execuções
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {formatDuration(stage.avg_latency_ms ?? undefined)}
                    </div>
                    <p className="text-xs text-muted-foreground">latência média</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de latência até o momento.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Detalhamento diário
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Consolidado de runs, falhas e custos por dia no período selecionado.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              <p className="mt-2 text-sm">Carregando métricas...</p>
            </div>
          ) : metrics.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Execuções</TableHead>
                    <TableHead className="text-right">Sucesso</TableHead>
                    <TableHead className="text-right">Falhas</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="text-right">Latência Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((row) => (
                    <TableRow key={`${row.metric_date}-${row.workflow_version_id}`}>
                      <TableCell className="font-medium">{formatDateLabel(row.metric_date)}</TableCell>
                      <TableCell className="text-right">{row.total_runs || 0}</TableCell>
                      <TableCell className="text-right">{row.completed_runs || 0}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={row.failed_runs ? 'text-destructive font-medium' : ''}
                        >
                          {row.failed_runs || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(row.total_cost_usd || 0), Number(row.total_cost_usd || 0) > 1 ? 2 : 4)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDuration(row.avg_latency_ms ?? undefined)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              Nenhum dado encontrado para o período informado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

