'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  WorkflowInstanceRecord,
  WorkflowStageRunRecord,
  WorkflowStageRecord,
} from '@/modules/laboratorio-ia/services/workflowOrchestrator'

function useFetcher<T>(url: string) {
  return useSWR<T>(url, async (input: string) => {
    const res = await fetch(input)
    if (!res.ok) throw new Error('Erro ao carregar dados')
    return res.json()
  })
}

interface WorkflowInstanceListResponse {
  instances: Array<WorkflowInstanceRecord & { workflow: { name: string } | null }>
}

export default function WorkflowInstancesPage() {
  const { data, isLoading, error, mutate } = useFetcher<WorkflowInstanceListResponse>('/api/lab-ia/workflows/instances')
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)

  const instances = data?.instances ?? []

  const selectedInstance = useMemo(() => {
    return instances.find((instance) => instance.id === selectedInstanceId) ?? instances[0] ?? null
  }, [instances, selectedInstanceId])

  if (error) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar workflows</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executões de Workflows</h1>
            <p className="text-muted-foreground">
              Acompanhe o progresso de workflows end-to-end, aprove ou retome etapas humanas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => mutate()}>
              Atualizar
            </Button>
            <Button asChild>
              <Link href="/ai-lab/workflows/designer">
                Criar Workflow
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Instâncias Recentes</CardTitle>
              <CardDescription>Selecione uma execução para detalhar.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))}
                </div>
              ) : instances.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma execução encontrada. Inicie um workflow para acompanhar o progresso.
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <div className="space-y-3 pr-2">
                    {instances.map((instance) => (
                      <button
                        key={instance.id}
                        onClick={() => setSelectedInstanceId(instance.id)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition hover:border-primary',
                          selectedInstance?.id === instance.id && 'border-primary bg-primary/5'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              {instance.workflow?.name || 'Workflow sem nome'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Iniciado {formatDistanceToNow(new Date(instance.started_at!), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                          <Badge variant={statusVariant(instance.status)} className="uppercase">
                            {instance.status}
                          </Badge>
                        </div>
                        {instance.metadata?.patient?.name && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Paciente: <span className="font-medium">{instance.metadata.patient.name}</span>
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div>
            {selectedInstance ? (
              <WorkflowInstanceDetail instanceId={selectedInstance.id} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Selecione uma execução</CardTitle>
                  <CardDescription>Detalhes completos aparecerão aqui.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function statusVariant(status?: string) {
  switch (status) {
    case 'completed':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'waiting_human':
    case 'scheduled':
      return 'outline'
    case 'running':
    default:
      return 'secondary'
  }
}

interface InstanceDetailResponse {
  instance: WorkflowInstanceRecord & { workflow: { name: string } | null }
  stages: WorkflowStageRecord[]
  stageRuns: WorkflowStageRunRecord[]
  events: Array<{
    id: string
    event_type: string
    payload: any
    created_at: string
  }>
}

function WorkflowInstanceDetail({ instanceId }: { instanceId: string }) {
  const { data, error, isLoading, mutate } = useFetcher<InstanceDetailResponse>(`/api/lab-ia/workflows/instances/${instanceId}`)

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erro ao carregar instância</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando detalhes…</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    )
  }

  const { instance, stages, stageRuns, events } = data

  const sortedStages = stages.slice().sort((a, b) => {
    const orderA = a.order_hint ?? 0
    const orderB = b.order_hint ?? 0
    if (orderA === orderB) return a.stage_key.localeCompare(b.stage_key)
    return orderA - orderB
  })

  const runsByStage = new Map<string, WorkflowStageRunRecord>(stageRuns.map((run) => [run.stage_id, run]))

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>
            {instance.workflow?.name || 'Workflow sem nome'}
          </CardTitle>
          <CardDescription>
            Execução iniciada {formatDistanceToNow(new Date(instance.started_at!), { addSuffix: true, locale: ptBR })}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(instance.status)} className="uppercase">
            {instance.status}
          </Badge>
          <Button variant="secondary" onClick={() => mutate()}>
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
          <Separator className="my-3" />
          <div className="space-y-4">
            {sortedStages.map((stage, index) => {
              const run = runsByStage.get(stage.id)
              const status = run?.status || 'pending'

              return (
                <div key={stage.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold',
                        statusBubble(status)
                      )}
                    >
                      {index + 1}
                    </div>
                    {index < sortedStages.length - 1 && (
                      <div className="mt-1 h-full w-px bg-border" />
                    )}
                  </div>
                  <div className="flex-1 rounded-lg border p-4">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {stage.name || stage.stage_key}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Tipo: {stage.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(status)} className="uppercase text-xs">
                          {status}
                        </Badge>
                        {run?.attempt && run.attempt > 1 && (
                          <Badge variant="outline" className="text-xs">
                            {run.attempt} tentativas
                          </Badge>
                        )}
                      </div>
                    </div>

                    {run?.started_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Iniciada {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}

                    {run?.output_snapshot && Object.keys(run.output_snapshot).length > 0 && (
                      <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                        <p className="mb-1 font-semibold text-muted-foreground">Saída</p>
                        <pre className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                          {JSON.stringify(run.output_snapshot, null, 2)}
                        </pre>
                      </div>
                    )}

                    {Array.isArray((run?.output_snapshot as any)?.collaborations) &&
                      (run?.output_snapshot as any).collaborations.length > 0 && (
                        <div className="mt-3 space-y-3 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            Equipes colaborativas
                          </p>
                          {(run?.output_snapshot as any).collaborations.map(
                            (team: any, teamIndex: number) => (
                              <div key={`${stage.id}-team-${teamIndex}`} className="space-y-2 rounded-md border border-primary/20 bg-background/80 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {team.teamName || team.teamKey || 'Equipe'}
                                  </Badge>
                                  {team.strategy && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      Estratégia: {team.strategy}
                                    </Badge>
                                  )}
                                  {team.consensusStatus && (
                                    <Badge
                                      variant={
                                        team.consensusStatus === 'approved'
                                          ? 'secondary'
                                          : 'outline'
                                      }
                                      className="text-[10px]"
                                    >
                                      {team.consensusStatus === 'approved'
                                        ? 'Consenso'
                                        : 'Precisa revisão'}
                                    </Badge>
                                  )}
                                </div>
                                {team.summary && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {team.summary}
                                  </p>
                                )}
                                {team.decision && (
                                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-muted/40 bg-muted/20 p-2 text-[10px] text-muted-foreground">
                                    {JSON.stringify(team.decision, null, 2)}
                                  </pre>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}

                    {run?.error_info && (
                      <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                        <p className="mb-1 font-semibold">Erro</p>
                        <pre className="whitespace-pre-wrap break-words text-[11px]">
                          {JSON.stringify(run.error_info, null, 2)}
                        </pre>
                      </div>
                    )}

                    {status === 'waiting_human' && run && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 p-3">
                        <div className="max-w-[70%] text-xs text-muted-foreground">
                          Etapa aguardando input humano. Use o botão abaixo para enviar submissão.
                        </div>
                        <Button size="sm" asChild variant="default">
                          <Link href={`/ai-lab/workflows/stage/${run.id}`}>Fornecer input</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Eventos</h3>
          <Separator className="my-3" />
          <div className="space-y-3">
            {events.slice(0, 12).map((event) => (
              <div key={event.id} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="uppercase">
                    {event.event_type}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contexto Global</h3>
          <Separator className="my-3" />
          <div className="rounded-lg border bg-muted/40 p-4">
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {JSON.stringify(instance.context, null, 2)}
            </pre>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

function statusBubble(status: string) {
  switch (status) {
    case 'completed':
      return 'border-green-500 bg-green-500/10 text-green-600'
    case 'failed':
      return 'border-red-500 bg-red-500/10 text-red-600'
    case 'waiting_human':
      return 'border-amber-500 bg-amber-500/10 text-amber-600'
    case 'scheduled':
      return 'border-blue-500 bg-blue-500/10 text-blue-600'
    case 'running':
      return 'border-primary bg-primary/10 text-primary'
    default:
      return 'border-muted text-muted-foreground'
  }
}

