'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Trash2, Calendar, Globe2, Activity, Share2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type TriggerType = 'calendar' | 'webhook' | 'data' | 'user_event'

interface WorkflowTrigger {
  id: string
  workflow_version_id: string
  type: TriggerType
  config: Record<string, any>
  is_active: boolean
  notes?: string | null
  tags?: string[] | null
  created_at: string
  updated_at: string
  last_trigger_at?: string | null
}

interface WorkflowVersionOption {
  id: string
  version_label: string
  workflow: { id: string; name: string }
}

const EMPTY_FORM = {
  workflow_version_id: '',
  type: 'calendar' as TriggerType,
  cron: '0 9 * * MON',
  timezone: 'America/Sao_Paulo',
  payload: '',
  metadata: '',
  configJSON: '',
  notes: '',
  tags: '',
  is_active: true,
}

export default function WorkflowTriggersAdminPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [checkingRole, setCheckingRole] = useState(true)
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([])
  const [workflowVersions, setWorkflowVersions] = useState<WorkflowVersionOption[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    checkUserRole()
  }, [user])

  useEffect(() => {
    if (!checkingRole) {
      Promise.all([fetchTriggers(), fetchVersions()])
    }
  }, [checkingRole])

  const checkUserRole = async () => {
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

      if (!profile || profile.role !== 'admin') {
        toast.error('Acesso negado. Apenas administradores podem acessar esta página.')
        router.push('/ai-lab')
        return
      }

      setCheckingRole(false)
    } catch (err) {
      console.error('Error checking user role:', err)
      toast.error('Erro ao verificar permissões')
      router.push('/ai-lab')
    }
  }

  const fetchVersions = async () => {
    try {
      const response = await fetch('/api/lab-ia/workflows/versions?limit=100')
      if (!response.ok) throw new Error('Erro ao carregar versões de workflow')
      const data = await response.json()
      setWorkflowVersions(
        (data?.versions || []).map((version: any) => ({
          id: version.id,
          version_label: version.version_label,
          workflow: version.workflow || { id: version.workflow_id, name: 'Workflow' },
        }))
      )
    } catch (error) {
      console.error('Error fetching workflow versions:', error)
      toast.error('Erro ao carregar versões de workflow')
    }
  }

  const fetchTriggers = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/workflows/triggers')
      if (!response.ok) throw new Error('Erro ao buscar triggers')
      const data = await response.json()
      setTriggers(data.triggers || [])
    } catch (error) {
      console.error('Error fetching triggers:', error)
      toast.error('Erro ao carregar triggers')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (trigger?: WorkflowTrigger) => {
    if (trigger) {
      setEditingId(trigger.id)
      const tagsValue = trigger.tags?.join(', ') ?? ''
      const baseForm = {
        workflow_version_id: trigger.workflow_version_id,
        type: trigger.type,
        notes: trigger.notes || '',
        tags: tagsValue,
        is_active: trigger.is_active,
        cron: '',
        timezone: '',
        payload: JSON.stringify(trigger.config?.payload || {}, null, 2),
        metadata: JSON.stringify(trigger.config?.metadata || {}, null, 2),
        configJSON: JSON.stringify(trigger.config || {}, null, 2),
      }

      if (trigger.type === 'calendar') {
        setFormData({
          ...baseForm,
          cron: trigger.config?.cron || '0 9 * * MON',
          timezone: trigger.config?.timezone || 'America/Sao_Paulo',
          payload: JSON.stringify(trigger.config?.payload || {}, null, 2),
          metadata: JSON.stringify(trigger.config?.metadata || {}, null, 2),
        })
      } else {
        setFormData({
          ...baseForm,
          configJSON: JSON.stringify(trigger.config || {}, null, 2),
        })
      }
    } else {
      setEditingId(null)
      setFormData(EMPTY_FORM)
    }
    setOpenDialog(true)
  }

  const resetDialog = () => {
    setOpenDialog(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
  }

  const buildConfig = () => {
    try {
      if (formData.type === 'calendar') {
        const payload = formData.payload.trim()
        const metadata = formData.metadata.trim()
        return {
          cron: formData.cron,
          timezone: formData.timezone || undefined,
          payload: payload ? JSON.parse(payload) : {},
          metadata: metadata ? JSON.parse(metadata) : {},
        }
      }

      const config = formData.configJSON.trim()
      return config ? JSON.parse(config) : {}
    } catch (error) {
      throw new Error('JSON de configuração inválido')
    }
  }

  const handleSave = async () => {
    if (!formData.workflow_version_id) {
      toast.error('Selecione uma versão de workflow')
      return
    }
    setSaving(true)
    try {
      const config = buildConfig()
      const tags = formData.tags
        ? formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : []

      const payload = {
        workflow_version_id: formData.workflow_version_id,
        type: formData.type,
        config,
        is_active: formData.is_active,
        notes: formData.notes || null,
        tags,
      }

      const url = editingId
        ? `/api/lab-ia/admin/workflows/triggers/${editingId}`
        : '/api/lab-ia/admin/workflows/triggers'

      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao salvar trigger')
      }

      toast.success(editingId ? 'Trigger atualizado!' : 'Trigger criado!')
      resetDialog()
      fetchTriggers()
    } catch (error: any) {
      console.error('Error saving trigger:', error)
      toast.error(error.message || 'Erro ao salvar trigger')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/lab-ia/admin/workflows/triggers/${deleteId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Erro ao remover trigger')
      toast.success('Trigger removido!')
      setDeleteId(null)
      fetchTriggers()
    } catch (error) {
      console.error('Error deleting trigger:', error)
      toast.error('Erro ao remover trigger')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (trigger: WorkflowTrigger, value: boolean) => {
    setTogglingId(trigger.id)
    try {
      const response = await fetch(`/api/lab-ia/admin/workflows/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: value }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao atualizar trigger')
      }
      setTriggers((prev) =>
        prev.map((item) =>
          item.id === trigger.id ? { ...item, is_active: value } : item
        )
      )
    } catch (error) {
      console.error('Error toggling trigger:', error)
      toast.error('Erro ao atualizar trigger')
    } finally {
      setTogglingId(null)
    }
  }

  const filteredTriggers = useMemo(() => {
    return triggers.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [triggers])

  if (checkingRole || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            {checkingRole ? 'Verificando permissões...' : 'Carregando triggers...'}
          </p>
        </div>
      </div>
    )
  }

  const renderConfigPreview = (trigger: WorkflowTrigger) => {
    if (trigger.type === 'calendar') {
      return (
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cron:</span>
            <span className="font-mono text-xs">{trigger.config?.cron}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timezone:</span>
            <span>{trigger.config?.timezone || 'UTC'}</span>
          </div>
        </div>
      )
    }
    return (
      <pre className="mt-2 max-h-32 overflow-auto rounded border border-muted/40 bg-muted/20 p-2 text-xs">
        {JSON.stringify(trigger.config, null, 2)}
      </pre>
    )
  }

  const typeIconMap: Record<TriggerType, React.ReactNode> = {
    calendar: <Calendar className="h-4 w-4 text-primary" />,
    webhook: <Share2 className="h-4 w-4 text-primary" />,
    data: <Activity className="h-4 w-4 text-primary" />,
    user_event: <Globe2 className="h-4 w-4 text-primary" />,
  }

  return (
    <div className="min-h-screen bg-background p-8 dark:bg-slate-950 dark:text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-white">
              Triggers de Workflows
            </h1>
            <p className="text-muted-foreground dark:text-slate-300 mt-1">
              Automatize execuções com disparos baseados em horário, webhooks ou eventos de dados.
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            + Novo Trigger
          </Button>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTriggers.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300">
              Nenhum trigger configurado até o momento.
            </div>
          ) : null}

          {filteredTriggers.map((trigger) => (
            <Card
              key={trigger.id}
              className="dark:bg-slate-900/80 dark:border-slate-700/60 transition hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-sky-500/10"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-lg text-foreground dark:text-white flex items-center gap-2">
                    {typeIconMap[trigger.type]}
                    {trigger.type === 'calendar' && 'Calendário'}
                    {trigger.type === 'webhook' && 'Webhook'}
                    {trigger.type === 'data' && 'Condição de Dados'}
                    {trigger.type === 'user_event' && 'Evento de Usuário'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Criado em {new Date(trigger.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={trigger.is_active}
                    disabled={togglingId === trigger.id}
                    onCheckedChange={(value) => handleToggleActive(trigger, value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground dark:text-slate-400">Versão:</span>
                  <span className="font-medium text-foreground dark:text-slate-100">{trigger.workflow_version_id}</span>
                </div>
                {trigger.notes ? (
                  <div className="rounded-md border border-muted/40 bg-muted/20 p-2 text-xs dark:border-slate-700/60 dark:bg-slate-800/60">
                    {trigger.notes}
                  </div>
                ) : null}
                {trigger.tags && trigger.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {trigger.tags.map((tag) => (
                      <Badge key={`${trigger.id}-${tag}`} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {renderConfigPreview(trigger)}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Último disparo:</span>
                  <span className="font-medium">
                    {trigger.last_trigger_at
                      ? new Date(trigger.last_trigger_at).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(trigger)}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteId(trigger.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar trigger' : 'Novo trigger'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Workflow / Versão *</Label>
                <Select
                  value={formData.workflow_version_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, workflow_version_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a versão" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowVersions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.workflow?.name || 'Workflow'} — {version.version_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value as TriggerType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">Calendário (cron)</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="data">Condição de dados</SelectItem>
                    <SelectItem value="user_event">Evento de usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'calendar' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cron">Expressão cron *</Label>
                    <Input
                      id="cron"
                      value={formData.cron}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, cron: event.target.value }))
                      }
                      placeholder="Ex.: 0 9 * * MON"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={formData.timezone}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, timezone: event.target.value }))
                      }
                      placeholder="Ex.: America/Sao_Paulo"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Payload (JSON)</Label>
                    <Textarea
                      rows={4}
                      value={formData.payload}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, payload: event.target.value }))
                      }
                      placeholder='{"context":{"patientId":"123"}}'
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Metadata (JSON)</Label>
                    <Textarea
                      rows={4}
                      value={formData.metadata}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, metadata: event.target.value }))
                      }
                      placeholder='{"source":"calendar"}'
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Configuração (JSON)</Label>
                <Textarea
                  rows={6}
                  value={formData.configJSON}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, configJSON: event.target.value }))
                  }
                  placeholder='{ "url": "https://webhook.site/..." }'
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Anotações</Label>
              <Textarea
                rows={3}
                value={formData.notes}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="Descrição rápida sobre quando este trigger dispara."
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={formData.tags}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, tags: event.target.value }))
                }
                placeholder="Ex.: marketing, pacientes"
              />
              <p className="text-xs text-muted-foreground">
                Separe múltiplas tags por vírgula.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/10 px-3 py-2">
              <div>
                <Label className="text-sm font-medium">Trigger ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Controla se o trigger está autorizado a executar automaticamente.
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(value) =>
                  setFormData((prev) => ({ ...prev, is_active: value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Salvar alterações' : 'Criar trigger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(value) => !value && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir trigger</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O trigger deixará de ser executado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


