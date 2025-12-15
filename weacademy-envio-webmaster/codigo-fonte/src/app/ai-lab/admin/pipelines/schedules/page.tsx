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
import type { PipelineSchedule, PipelineScheduleFormData } from '@/lib/validations/pipelineSchedule.schema'
import type { Pipeline } from '@/lib/validations/pipeline.schema'
import { Calendar, Clock, ExternalLink, Trash2, Play, Edit, Plus } from 'lucide-react'
import { formatScheduleDescription } from '@/modules/laboratorio-ia/services/scheduler'

export default function PipelineSchedulesPage() {
  const [schedules, setSchedules] = useState<(PipelineSchedule & { pipeline?: Pipeline })[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<PipelineSchedule | null>(null)
  const [formData, setFormData] = useState<Partial<PipelineScheduleFormData>>({
    name: '',
    description: '',
    schedule_type: 'interval',
    schedule_config: { interval: 'daily', time: '09:00' },
    enabled: true,
  })

  useEffect(() => {
    fetchSchedules()
    fetchPipelines()
  }, [])

  const fetchSchedules = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/admin/pipelines/schedules', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) throw new Error('Failed to fetch schedules')
      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
      toast.error('Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.pipeline_id || !formData.schedule_type || !formData.schedule_config) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const url = editingSchedule
        ? `/api/lab-ia/admin/pipelines/schedules/${editingSchedule.id}`
        : '/api/lab-ia/admin/pipelines/schedules'

      const method = editingSchedule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao salvar agendamento')
      }

      toast.success(editingSchedule ? 'Agendamento atualizado!' : 'Agendamento criado!')
      setOpenDialog(false)
      resetForm()
      fetchSchedules()
    } catch (error: any) {
      console.error('Error saving schedule:', error)
      toast.error(error.message || 'Erro ao salvar agendamento')
    }
  }

  const handleDelete = async () => {
    if (!deleteScheduleId) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/pipelines/schedules/${deleteScheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to delete schedule')

      toast.success('Agendamento deletado!')
      setDeleteScheduleId(null)
      fetchSchedules()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Erro ao deletar agendamento')
    }
  }

  const handleEdit = (schedule: PipelineSchedule) => {
    setEditingSchedule(schedule)
    setFormData({
      pipeline_id: schedule.pipeline_id,
      name: schedule.name,
      description: schedule.description,
      schedule_type: schedule.schedule_type,
      schedule_config: schedule.schedule_config as any,
      input_data: schedule.input_data as any,
      enabled: schedule.enabled,
    })
    setOpenDialog(true)
  }

  const handleRunNow = async (scheduleId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/pipelines/schedules/${scheduleId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao executar agendamento')
      }

      toast.success('Pipeline executado!')
    } catch (error: any) {
      console.error('Error running schedule:', error)
      toast.error(error.message || 'Erro ao executar agendamento')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      schedule_type: 'interval',
      schedule_config: { interval: 'daily', time: '09:00' },
      enabled: true,
    })
    setEditingSchedule(null)
  }

  const handleScheduleTypeChange = (type: 'cron' | 'interval' | 'webhook' | 'event') => {
    setFormData({
      ...formData,
      schedule_type: type,
      schedule_config: type === 'cron' 
        ? { cron: '0 9 * * *' }
        : type === 'interval'
        ? { interval: 'daily', time: '09:00' }
        : type === 'webhook'
        ? { webhook_path: `/webhook/${crypto.randomUUID().substring(0, 8)}` }
        : { event_type: 'user.created' },
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando agendamentos...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agendamentos de Pipelines</h1>
          <p className="text-muted-foreground mt-1">
            Configure execuções automáticas de pipelines
          </p>
        </div>
        <Button onClick={() => { resetForm(); setOpenDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schedules.map((schedule) => (
          <Card key={schedule.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{schedule.name}</CardTitle>
                  {schedule.pipeline && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {schedule.pipeline.name}
                    </p>
                  )}
                </div>
                <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                  {schedule.enabled ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedule.description && (
                <p className="text-sm text-muted-foreground">{schedule.description}</p>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {formatScheduleDescription({
                    schedule_type: schedule.schedule_type,
                    schedule_config: schedule.schedule_config as any,
                  })}
                </span>
              </div>

              {schedule.next_run_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Próxima: {new Date(schedule.next_run_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              {schedule.last_run_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Última: {new Date(schedule.last_run_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(schedule)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => schedule.id && handleRunNow(schedule.id)}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Executar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteScheduleId(schedule.id!)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {schedules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum agendamento configurado. Clique em "Novo Agendamento" para começar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pipeline_id">Pipeline *</Label>
              <Select
                value={formData.pipeline_id}
                onValueChange={(value) => setFormData({ ...formData, pipeline_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.filter(p => p.active).map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id!}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Relatório Diário de Marketing"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do agendamento"
              />
            </div>

            <div>
              <Label htmlFor="schedule_type">Tipo de Agendamento *</Label>
              <Select
                value={formData.schedule_type}
                onValueChange={(value: any) => handleScheduleTypeChange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interval">Intervalo (Diário, Semanal, etc.)</SelectItem>
                  <SelectItem value="cron">Cron (Expressão Avançada)</SelectItem>
                  <SelectItem value="webhook">Webhook (Trigger Externo)</SelectItem>
                  <SelectItem value="event">Evento (Baseado em Ações)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Configuração baseada no tipo */}
            {formData.schedule_type === 'interval' && (
              <div className="space-y-4 border p-4 rounded-lg">
                <div>
                  <Label htmlFor="interval">Frequência</Label>
                  <Select
                    value={(formData.schedule_config as any)?.interval}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      schedule_config: { ...(formData.schedule_config as any), interval: value, time: (formData.schedule_config as any)?.time || '09:00' },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">A cada hora</SelectItem>
                      <SelectItem value="daily">Diariamente</SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                      <SelectItem value="monthly">Mensalmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {['daily', 'weekly', 'monthly'].includes((formData.schedule_config as any)?.interval) && (
                  <div>
                    <Label htmlFor="time">Horário (HH:MM)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={(formData.schedule_config as any)?.time || '09:00'}
                      onChange={(e) => setFormData({
                        ...formData,
                        schedule_config: { ...(formData.schedule_config as any), time: e.target.value },
                      })}
                    />
                  </div>
                )}

                {(formData.schedule_config as any)?.interval === 'weekly' && (
                  <div>
                    <Label htmlFor="dayOfWeek">Dia da Semana</Label>
                    <Select
                      value={String((formData.schedule_config as any)?.dayOfWeek || '1')}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        schedule_config: { ...(formData.schedule_config as any), dayOfWeek: parseInt(value) },
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Domingo</SelectItem>
                        <SelectItem value="1">Segunda</SelectItem>
                        <SelectItem value="2">Terça</SelectItem>
                        <SelectItem value="3">Quarta</SelectItem>
                        <SelectItem value="4">Quinta</SelectItem>
                        <SelectItem value="5">Sexta</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(formData.schedule_config as any)?.interval === 'monthly' && (
                  <div>
                    <Label htmlFor="dayOfMonth">Dia do Mês (1-31)</Label>
                    <Input
                      id="dayOfMonth"
                      type="number"
                      min="1"
                      max="31"
                      value={(formData.schedule_config as any)?.dayOfMonth || '1'}
                      onChange={(e) => setFormData({
                        ...formData,
                        schedule_config: { ...(formData.schedule_config as any), dayOfMonth: parseInt(e.target.value) },
                      })}
                    />
                  </div>
                )}
              </div>
            )}

            {formData.schedule_type === 'cron' && (
              <div>
                <Label htmlFor="cron">Expressão Cron *</Label>
                <Input
                  id="cron"
                  value={(formData.schedule_config as any)?.cron || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    schedule_config: { cron: e.target.value },
                  })}
                  placeholder="0 9 * * * (minuto hora dia mês dia-semana)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: minuto hora dia mês dia-semana (0-59) (0-23) (1-31) (1-12) (0-6)
                </p>
              </div>
            )}

            {formData.schedule_type === 'webhook' && (
              <div>
                <Label htmlFor="webhook_path">Caminho do Webhook *</Label>
                <Input
                  id="webhook_path"
                  value={(formData.schedule_config as any)?.webhook_path || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    schedule_config: { webhook_path: e.target.value },
                  })}
                  placeholder="/webhook/pipeline-xxx"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL: {typeof window !== 'undefined' ? window.location.origin : ''}/api/lab-ia/webhooks
                  {(formData.schedule_config as any)?.webhook_path || '/[caminho]'}
                </p>
              </div>
            )}

            {formData.schedule_type === 'event' && (
              <div>
                <Label htmlFor="event_type">Tipo de Evento *</Label>
                <Input
                  id="event_type"
                  value={(formData.schedule_config as any)?.event_type || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    schedule_config: { event_type: e.target.value },
                  })}
                  placeholder="ex: user.created, course.enrolled"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Eventos disponíveis: user.created, course.enrolled, etc.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Ativo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenDialog(false); resetForm() }}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteScheduleId} onOpenChange={(open) => !open && setDeleteScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

