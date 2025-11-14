'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AlarmClock, ClipboardList, Loader2, RefreshCw, ShieldAlert, UserRound } from 'lucide-react'

type HumanTaskRecord = {
  id: string
  workflow_instance_id: string
  stage_id: string
  stage_run_id: string
  status: string
  assignment: Record<string, any> | null
  assignee_user_id?: string | null
  assignee_role?: string | null
  assigned_at?: string | null
  started_at?: string | null
  due_at?: string | null
  completed_at?: string | null
  completed_by?: string | null
  decision?: string | null
  decision_reason?: string | null
  sla_seconds?: number | null
  reminder_strategy?: Record<string, any> | null
  escalation_config?: Record<string, any> | null
  metadata?: Record<string, any> | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

type HumanTaskLogRecord = {
  id: string
  human_task_id: string
  action: string
  actor_user_id?: string | null
  payload?: Record<string, any> | null
  created_at: string
}

type StageMetadata = {
  id: string
  name?: string | null
  stage_key: string
  workflow_version_id: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'escalated', label: 'Escalonadas' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Rejeitadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'all', label: 'Todas' },
]

const STATUS_VARIANTS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-200',
  escalated: 'bg-purple-100 text-purple-800 dark:bg-purple-400/10 dark:text-purple-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200',
  cancelled: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
}

function formatDate(dateIso?: string | null) {
  if (!dateIso) return '-'
  const date = new Date(dateIso)
  return `${date.toLocaleString('pt-BR')} (${formatDistanceToNow(date, { addSuffix: true, locale: ptBR })})`
}

function formatStatusBadge(status: string) {
  const normalized = status.toLowerCase()
  return STATUS_OPTIONS.find((option) => option.value === normalized)?.label ?? status
}

export default function HumanTasksAdminPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<HumanTaskRecord[]>([])
  const [stageMetadata, setStageMetadata] = useState<Record<string, StageMetadata>>({})
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTask, setSelectedTask] = useState<HumanTaskRecord | null>(null)
  const [taskLogs, setTaskLogs] = useState<HumanTaskLogRecord[]>([])
  const [taskLogsLoading, setTaskLogsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    const verifyRole = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) throw error

        if (!profile || !['admin', 'gestor_we'].includes(profile.role)) {
          router.push('/ai-lab')
          return
        }

        setCheckingRole(false)
      } catch (err) {
        console.error('[HumanTasksAdmin] erro ao verificar permissões:', err)
        router.push('/ai-lab')
      }
    }

    verifyRole()
  }, [router, user])

  const fetchStageMetadata = async (stageIds: string[]) => {
    if (stageIds.length === 0) {
      setStageMetadata({})
      return
    }

    const { data, error } = await supabase
      .from('lab_workflow_stages')
      .select('id, name, stage_key, workflow_version_id')
      .in('id', stageIds)

    if (error) {
      console.error('[HumanTasksAdmin] erro ao carregar metadados de etapa:', error)
      return
    }

    const map: Record<string, StageMetadata> = {}
    ;(data || []).forEach((stage) => {
      map[stage.id] = stage as StageMetadata
    })
    setStageMetadata(map)
  }

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (includeCompleted) {
        params.set('include_completed', 'true')
      }

      const response = await fetch(`/api/lab-ia/workflows/human-tasks?${params.toString()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Erro ao listar tarefas')
      }

      const payload = await response.json()
      const records: HumanTaskRecord[] = payload.tasks || []
      setTasks(records)

      const stageIds = Array.from(new Set(records.map((task) => task.stage_id).filter(Boolean)))
      await fetchStageMetadata(stageIds)
    } catch (error) {
      console.error('[HumanTasksAdmin] erro ao buscar tarefas humanas:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!checkingRole) {
      fetchTasks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingRole, statusFilter, includeCompleted])

  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return tasks
    return tasks.filter((task) => {
      const stage = stageMetadata[task.stage_id]
      const matchesStage = stage?.name?.toLowerCase().includes(term) || stage?.stage_key.toLowerCase().includes(term)
      const matchesInstance = task.workflow_instance_id.toLowerCase().includes(term)
      const matchesDecision = task.decision?.toLowerCase().includes(term)
      return matchesStage || matchesInstance || matchesDecision
    })
  }, [searchTerm, stageMetadata, tasks])

  const openTaskDetails = async (task: HumanTaskRecord) => {
    setSelectedTask(task)
    setIsDialogOpen(true)
    setTaskLogs([])
    setTaskLogsLoading(true)
    try {
      const response = await fetch(`/api/lab-ia/workflows/human-tasks/${task.id}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Erro ao carregar detalhes')
      }
      const payload = await response.json()
      setTaskLogs(payload.logs || [])
      if (payload.task) {
        setSelectedTask(payload.task)
      }
    } catch (error) {
      console.error('[HumanTasksAdmin] erro ao carregar detalhes da tarefa:', error)
    } finally {
      setTaskLogsLoading(false)
    }
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedTask(null)
    setTaskLogs([])
  }

  if (checkingRole) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Verificando permissões...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-10 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tarefas Humanas em Workflows</h1>
            <p className="text-muted-foreground">
              Monitore aprovações, SLA e escalonamentos de etapas human-in-the-loop.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/ai-lab/admin/pipelines" className="inline-flex">
              <Button variant="outline">Voltar</Button>
            </Link>
            <Button variant="outline" onClick={fetchTasks} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Recarregar
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              Filtros
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Busca</Label>
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por etapa, workflow ou decisão..."
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <Label className="text-xs uppercase text-muted-foreground">Incluir finalizadas</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-completed"
                    checked={includeCompleted}
                    onCheckedChange={setIncludeCompleted}
                  />
                  <Label htmlFor="include-completed">Mostrar aprovadas/rejeitadas</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Carregando tarefas humanas...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="text-base font-medium text-muted-foreground">Nenhuma tarefa encontrada.</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou execute um workflow que contenha etapas humanas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredTasks.map((task) => {
              const stage = stageMetadata[task.stage_id]
              const statusClass = STATUS_VARIANTS[task.status] ?? 'bg-muted text-foreground'
              const dueSoon =
                task.due_at && !['approved', 'rejected', 'cancelled'].includes(task.status) && new Date(task.due_at).getTime() < Date.now() + 60 * 60 * 1000
              return (
                <Card
                  key={task.id}
                  className={cn(
                    'flex h-full flex-col justify-between border-l-4',
                    dueSoon && 'border-l-amber-500',
                    task.status === 'escalated' && 'border-l-purple-500'
                  )}
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {stage?.name || 'Etapa sem nome'}
                      </CardTitle>
                      <Badge className={statusClass}>{formatStatusBadge(task.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stage?.stage_key} · Instância {task.workflow_instance_id.slice(0, 8)}...
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Atribuído a{' '}
                        {task.assignee_user_id
                          ? `usuário ${task.assignee_user_id.slice(0, 6)}…`
                          : task.assignee_role
                          ? `função "${task.assignee_role}"`
                          : 'definido via contexto'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlarmClock className="h-4 w-4 text-muted-foreground" />
                      <span>Prazo: {formatDate(task.due_at)}</span>
                    </div>
                    {task.decision && (
                      <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        Última decisão: <strong>{task.decision}</strong>{' '}
                        {task.decision_reason ? `— ${task.decision_reason}` : ''}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => openTaskDetails(task)}>
                      Ver detalhes
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Logs
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ações registradas</AlertDialogTitle>
                        </AlertDialogHeader>
                        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-2">
                          {taskLogs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhum log carregado. Abra os detalhes da tarefa para sincronizar.
                            </p>
                          ) : (
                            taskLogs.map((log) => (
                              <div
                                key={log.id}
                                className="rounded-md border border-muted p-2 text-xs text-muted-foreground"
                              >
                                <div className="mb-1 flex items-center justify-between">
                                  <Badge variant="secondary">{log.action}</Badge>
                                  <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                </div>
                                {log.payload && (
                                  <pre className="whitespace-pre-wrap break-all">
                                    {JSON.stringify(log.payload, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Fechar</AlertDialogCancel>
                          <AlertDialogAction>Ok</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent className="max-w-3xl space-y-4">
          <DialogHeader>
            <DialogTitle>Detalhes da tarefa humana</DialogTitle>
          </DialogHeader>

          {!selectedTask ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Selecione uma tarefa para visualizar detalhes.
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Stage</p>
                  <p className="text-sm font-medium">
                    {stageMetadata[selectedTask.stage_id]?.name || stageMetadata[selectedTask.stage_id]?.stage_key}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <p className="text-sm font-medium">{formatStatusBadge(selectedTask.status)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Atribuído a</p>
                  <p className="text-sm">
                    {selectedTask.assignee_user_id
                      ? `Usuário ${selectedTask.assignee_user_id}`
                      : selectedTask.assignee_role
                      ? `Função ${selectedTask.assignee_role}`
                      : 'Contexto dinâmico'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Prazo</p>
                  <p className="text-sm">{formatDate(selectedTask.due_at)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs uppercase text-muted-foreground">Assignment</p>
                <pre className="max-h-60 overflow-auto rounded-md bg-muted/30 p-3 text-xs">
                  {JSON.stringify(selectedTask.assignment ?? {}, null, 2)}
                </pre>
              </div>

              {selectedTask.metadata && Object.keys(selectedTask.metadata).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-xs uppercase text-muted-foreground">Metadados</p>
                    <pre className="max-h-60 overflow-auto rounded-md bg-muted/30 p-3 text-xs">
                      {JSON.stringify(selectedTask.metadata, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Histórico de ações</p>
                  {taskLogsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {taskLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum log disponível. Ações serão listadas após movimentações da tarefa.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                    {taskLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-md border border-muted bg-muted/20 p-3 text-xs text-muted-foreground"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <Badge variant="secondary">{log.action}</Badge>
                          <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        {log.actor_user_id && (
                          <p className="mb-2 text-[11px] uppercase tracking-wide">
                            Usuário: <span className="font-medium">{log.actor_user_id}</span>
                          </p>
                        )}
                        {log.payload && (
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={closeDialog}>Fechar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

