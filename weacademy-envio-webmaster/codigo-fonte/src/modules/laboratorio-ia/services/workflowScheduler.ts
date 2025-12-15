import { createClient } from '@supabase/supabase-js'
import { createWorkflowInstance, processWorkflowInstance } from './workflowOrchestrator'

export type WorkflowTriggerType = 'calendar' | 'webhook' | 'data' | 'user_event'

export interface WorkflowTriggerRecord {
  id: string
  workflow_version_id: string
  type: WorkflowTriggerType
  config: Record<string, any>
  is_active: boolean
  last_trigger_at: string | null
  created_at: string
  updated_at: string
}

export interface CalendarTriggerConfig {
  cron: string // ex.: "0 9 * * MON"
  timezone?: string
  payload?: Record<string, any>
  maxConcurrency?: number
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey)
}

function getTimezoneOffset(date: Date, timeZone?: string) {
  if (!timeZone) return date.getTimezoneOffset()
  const dtf = new Intl.DateTimeFormat('en-US', {
    hour12: false,
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const map = new Map(parts.map((part) => [part.type, part.value]))
  const adjusted = new Date(
    `${map.get('year')}-${map.get('month')}-${map.get('day')}T${map.get('hour')}:${map.get('minute')}:${map.get('second')}Z`
  )
  return -(adjusted.getTime() - date.getTime()) / 60000
}

function cronMatches(date: Date, cron: string, timezone?: string) {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.trim().split(' ')
  const current = new Date(date)

  if (timezone) {
    const offset = getTimezoneOffset(date, timezone)
    current.setMinutes(current.getMinutes() + offset - date.getTimezoneOffset())
  }

  const match = (field: string, value: number) => {
    if (field === '*') return true
    return field.split(',').some((chunk) => {
      if (chunk.includes('/')) {
        const [range, step] = chunk.split('/')
        const stepValue = parseInt(step, 10)
        if (Number.isNaN(stepValue) || stepValue <= 0) return false
        if (range === '*') return value % stepValue === 0
        const [start, end] = range.split('-').map((num) => parseInt(num, 10))
        if (Number.isNaN(start) || Number.isNaN(end)) return false
        if (value < start || value > end) return false
        return (value - start) % stepValue === 0
      }
      if (chunk.includes('-')) {
        const [start, end] = chunk.split('-').map((num) => parseInt(num, 10))
        if (Number.isNaN(start) || Number.isNaN(end)) return false
        return value >= start && value <= end
      }
      const parsed = parseInt(chunk, 10)
      if (Number.isNaN(parsed)) return false
      return parsed === value
    })
  }

  return (
    match(minute, current.getMinutes()) &&
    match(hour, current.getHours()) &&
    match(dayOfMonth, current.getDate()) &&
    match(month, current.getMonth() + 1) &&
    match(dayOfWeek, current.getDay())
  )
}

export async function runCalendarTriggers(date: Date = new Date()) {
  const supabase = getServiceClient()

  const { data: triggers, error } = await supabase
    .from('lab_workflow_triggers')
    .select('*')
    .eq('type', 'calendar')
    .eq('is_active', true)

  if (error) {
    console.error('[WorkflowScheduler] Erro ao buscar triggers de calendário:', error)
    throw error
  }

  if (!triggers || triggers.length === 0) return []

  const results: Array<{ triggerId: string; instanceId?: string; skipped?: boolean; reason?: string }> = []

  for (const trigger of triggers as WorkflowTriggerRecord[]) {
    const config = (trigger.config || {}) as CalendarTriggerConfig
    if (!config.cron) {
      results.push({ triggerId: trigger.id, skipped: true, reason: 'cron ausente' })
      continue
    }

    if (!cronMatches(date, config.cron, config.timezone)) {
      results.push({ triggerId: trigger.id, skipped: true, reason: 'cron não corresponde ao horário atual' })
      continue
    }

    try {
      const { data: version } = await supabase
        .from('lab_workflow_versions')
        .select('id, workflow_id, settings')
        .eq('id', trigger.workflow_version_id)
        .eq('is_active', true)
        .single()

      if (!version) {
        results.push({ triggerId: trigger.id, skipped: true, reason: 'versão inativa ou inexistente' })
        continue
      }

      const ownerUserId = version.settings?.owner_user_id || config.payload?.owner_user_id
      if (!ownerUserId) {
        results.push({ triggerId: trigger.id, skipped: true, reason: 'owner_user_id não definido' })
        continue
      }

      const instance = await createWorkflowInstance({
        workflowVersionId: trigger.workflow_version_id,
        ownerUserId,
        context: config.payload?.context || {},
        metadata: {
          trigger_id: trigger.id,
          trigger_type: 'calendar',
          ...(config.payload?.metadata || {}),
        },
      })

      await processWorkflowInstance(instance.id)

      await supabase
        .from('lab_workflow_triggers')
        .update({ last_trigger_at: new Date().toISOString() })
        .eq('id', trigger.id)

      results.push({ triggerId: trigger.id, instanceId: instance.id })
    } catch (err) {
      console.error(`[WorkflowScheduler] Erro ao processar trigger ${trigger.id}:`, err)
      results.push({ triggerId: trigger.id, skipped: true, reason: (err as Error).message })
    }
  }

  return results
}


