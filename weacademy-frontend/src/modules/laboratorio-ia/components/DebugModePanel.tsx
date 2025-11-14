'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Play, 
  Pause, 
  Square, 
  StepForward, 
  StepBack, 
  Bug, 
  Eye, 
  Edit, 
  Download,
  Save,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DebugSession {
  id: string
  pipeline_id: string
  user_id: string
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error'
  current_step_order: number
  input_messages: any[]
  context_state: Record<string, any>
  variable_context: Record<string, any>
  executed_steps: Array<{
    order: number
    agent_id: string
    input?: any
    output?: string
    context_before?: Record<string, any>
    context_after?: Record<string, any>
    latency?: number
    cost?: number
  }>
  breakpoints: Array<{
    step_order: number
    enabled: boolean
    condition?: string
  }>
  created_at: string
  updated_at: string
}

interface DebugModePanelProps {
  pipelineId: string
  inputMessages: Array<{ role: string; content: string }>
  onSessionCreated?: (sessionId: string) => void
}

export function DebugModePanel({
  pipelineId,
  inputMessages,
  onSessionCreated,
}: DebugModePanelProps) {
  const [session, setSession] = useState<DebugSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [inspectingStep, setInspectingStep] = useState<number | null>(null)
  const [editingContext, setEditingContext] = useState(false)
  const [contextEdit, setContextEdit] = useState<string>('')
  const [breakpoints, setBreakpoints] = useState<Array<{ step_order: number; enabled: boolean; condition?: string }>>([])

  // Criar sessão de debug
  const createSession = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/pipelines/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          pipelineId,
          messages: inputMessages,
          breakpoints,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar sessão de debug')
      }

      const data = await response.json()
      setSession(data.session)
      
      if (onSessionCreated) {
        onSessionCreated(data.session.id)
      }

      // Iniciar polling para atualizar estado
      startPolling(data.session.id)
    } catch (error: any) {
      console.error('Erro ao criar sessão de debug:', error)
      alert(error.message || 'Erro ao criar sessão de debug')
    } finally {
      setLoading(false)
    }
  }

  // Polling para atualizar estado da sessão
  const startPolling = (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        const response = await fetch(`/api/lab-ia/pipelines/debug/${sessionId}`, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        })

        if (response.ok) {
          const data = await response.json()
          setSession(data.session)

          // Parar polling se sessão estiver completa ou parada
          if (data.session.status === 'completed' || data.session.status === 'stopped') {
            clearInterval(interval)
          }
        }
      } catch (error) {
        console.error('Erro ao buscar sessão:', error)
      }
    }, 1000) // Poll a cada 1 segundo

    // Cleanup ao desmontar
    return () => clearInterval(interval)
  }

  // Continuar execução
  const handleContinue = async () => {
    if (!session) return

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/debug/${session.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ action: 'continue' }),
      })

      if (!response.ok) {
        throw new Error('Erro ao continuar execução')
      }

      const data = await response.json()
      setSession(data.session)
    } catch (error: any) {
      console.error('Erro ao continuar:', error)
      alert(error.message || 'Erro ao continuar execução')
    } finally {
      setLoading(false)
    }
  }

  // Parar execução
  const handleStop = async () => {
    if (!session) return

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/debug/${session.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ action: 'stop' }),
      })

      if (!response.ok) {
        throw new Error('Erro ao parar execução')
      }

      const data = await response.json()
      setSession(data.session)
    } catch (error: any) {
      console.error('Erro ao parar:', error)
      alert(error.message || 'Erro ao parar execução')
    } finally {
      setLoading(false)
    }
  }

  // Step forward
  const handleStepForward = async () => {
    if (!session) return

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/debug/${session.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ action: 'step_forward' }),
      })

      if (!response.ok) {
        throw new Error('Erro ao avançar step')
      }

      const data = await response.json()
      setSession(data.session)
    } catch (error: any) {
      console.error('Erro ao avançar:', error)
      alert(error.message || 'Erro ao avançar step')
    } finally {
      setLoading(false)
    }
  }

  // Atualizar contexto
  const handleUpdateContext = async () => {
    if (!session || !contextEdit) return

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      let contextState
      try {
        contextState = JSON.parse(contextEdit)
      } catch {
        throw new Error('JSON inválido')
      }

      const response = await fetch(`/api/lab-ia/pipelines/debug/${session.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action: 'update_context',
          contextState,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar contexto')
      }

      const data = await response.json()
      setSession(data.session)
      setEditingContext(false)
      setContextEdit('')
    } catch (error: any) {
      console.error('Erro ao atualizar contexto:', error)
      alert(error.message || 'Erro ao atualizar contexto')
    } finally {
      setLoading(false)
    }
  }

  // Exportar estado
  const handleExport = async () => {
    if (!session) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/debug/${session.id}/export`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao exportar')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `debug-session-${session.id}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Erro ao exportar:', error)
      alert(error.message || 'Erro ao exportar estado')
    }
  }

  // Criar snapshot
  const handleCreateSnapshot = async () => {
    if (!session) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/debug/${session.id}/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          stepOrder: session.current_step_order,
          notes: `Snapshot no step ${session.current_step_order}`,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao criar snapshot')
      }

      alert('Snapshot criado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao criar snapshot:', error)
      alert(error.message || 'Erro ao criar snapshot')
    }
  }

  if (!session) {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Inicie uma sessão de debug para executar o pipeline passo a passo e inspecionar o contexto em cada etapa.
          </p>
          <Button onClick={createSession} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando sessão...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Debug Session
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Mode
          </div>
          <Badge variant={session.status === 'paused' ? 'default' : session.status === 'running' ? 'secondary' : 'outline'}>
            {session.status === 'paused' ? 'Pausado' : session.status === 'running' ? 'Executando' : session.status === 'stopped' ? 'Parado' : session.status === 'completed' ? 'Completo' : 'Erro'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controles */}
        <div className="flex items-center gap-2">
          {session.status === 'paused' && (
            <>
              <Button onClick={handleContinue} size="sm" disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                Continuar
              </Button>
              <Button onClick={handleStepForward} size="sm" variant="outline" disabled={loading}>
                <StepForward className="h-4 w-4 mr-2" />
                Step Forward
              </Button>
            </>
          )}
          {session.status === 'running' && (
            <Button onClick={handleStop} size="sm" variant="destructive" disabled={loading}>
              <Square className="h-4 w-4 mr-2" />
              Parar
            </Button>
          )}
          <Button onClick={handleCreateSnapshot} size="sm" variant="outline" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Snapshot
          </Button>
          <Button onClick={handleExport} size="sm" variant="outline" disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Estado atual */}
        <div className="border-t pt-4">
          <div className="text-sm font-semibold mb-2">Step Atual: {session.current_step_order}</div>
          
          {/* Steps executados */}
          {session.executed_steps && session.executed_steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Steps Executados:</div>
              {session.executed_steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-white dark:bg-gray-800 rounded text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Step {step.order}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setInspectingStep(step.order)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {step.output && (
                    <div className="text-muted-foreground truncate">
                      {step.output.substring(0, 100)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Contexto atual */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Contexto Atual:</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingContext(true)
                  setContextEdit(JSON.stringify(session.context_state, null, 2))
                }}
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
            </div>
            <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(session.context_state, null, 2)}
            </pre>
          </div>

          {/* Variáveis */}
          {session.variable_context && Object.keys(session.variable_context).length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="text-xs font-semibold mb-2">Variáveis:</div>
              <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(session.variable_context, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Dialog para inspecionar step */}
        <Dialog open={inspectingStep !== null} onOpenChange={(open) => !open && setInspectingStep(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Inspecionar Step {inspectingStep}</DialogTitle>
            </DialogHeader>
            {inspectingStep !== null && session.executed_steps[inspectingStep - 1] && (
              <div className="space-y-4">
                <div>
                  <Label>Contexto Antes:</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(session.executed_steps[inspectingStep - 1].context_before || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <Label>Input:</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(session.executed_steps[inspectingStep - 1].input || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <Label>Output:</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {session.executed_steps[inspectingStep - 1].output || 'N/A'}
                  </pre>
                </div>
                <div>
                  <Label>Contexto Depois:</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(session.executed_steps[inspectingStep - 1].context_after || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para editar contexto */}
        <Dialog open={editingContext} onOpenChange={setEditingContext}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Contexto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Contexto (JSON):</Label>
                <Textarea
                  value={contextEdit}
                  onChange={(e) => setContextEdit(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingContext(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateContext} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

