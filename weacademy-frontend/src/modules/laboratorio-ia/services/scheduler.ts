// @ts-nocheck
/**
 * Sistema de agendamento de pipelines
 * Calcula próximas execuções baseadas em cron, intervalos, webhooks e eventos
 */

export interface ScheduleConfig {
  schedule_type: 'cron' | 'interval' | 'webhook' | 'event'
  schedule_config: {
    cron?: string // "0 9 * * *" (minuto hora dia mês dia-semana)
    interval?: 'hourly' | 'daily' | 'weekly' | 'monthly'
    time?: string // "09:00" (HH:MM)
    dayOfWeek?: number // 0-6 (0 = domingo)
    dayOfMonth?: number // 1-31
    webhook_path?: string
    event_type?: string
    filters?: Record<string, any>
  }
}

/**
 * Calcula próxima execução baseada em cron
 */
export function calculateNextRunFromCron(cronExpression: string, fromDate: Date = new Date()): Date {
  // Formato cron: minuto hora dia mês dia-semana
  // Ex: "0 9 * * *" = todos os dias às 9h
  // Ex: "0 9 * * 1" = toda segunda às 9h
  // Ex: "0 9 1 * *" = todo dia 1 do mês às 9h

  const parts = cronExpression.split(' ')
  if (parts.length !== 5) {
    throw new Error('Cron expression deve ter 5 partes: minuto hora dia mês dia-semana')
  }

  const [minute, hour, day, month, dayOfWeek] = parts.map(p => p === '*' ? null : parseInt(p, 10))

  const nextRun = new Date(fromDate)
  nextRun.setSeconds(0)
  nextRun.setMilliseconds(0)

  // Se não é o dia certo, ajustar
  let attempts = 0
  const maxAttempts = 366 // Máximo 1 ano para encontrar próxima execução

  while (attempts < maxAttempts) {
    let changed = false

    // Ajustar mês
    if (month !== null && nextRun.getMonth() + 1 !== month) {
      nextRun.setMonth(month - 1)
      nextRun.setDate(1)
      nextRun.setHours(0, 0, 0, 0)
      changed = true
    }

    // Ajustar dia do mês
    if (day !== null && nextRun.getDate() !== day) {
      const daysInMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()
      const targetDay = Math.min(day, daysInMonth)

      if (nextRun.getDate() < targetDay) {
        nextRun.setDate(targetDay)
      } else {
        nextRun.setMonth(nextRun.getMonth() + 1)
        nextRun.setDate(targetDay)
      }
      nextRun.setHours(0, 0, 0, 0)
      changed = true
    }

    // Ajustar dia da semana
    if (dayOfWeek !== null) {
      const currentDayOfWeek = nextRun.getDay()
      if (currentDayOfWeek !== dayOfWeek) {
        const daysToAdd = (dayOfWeek - currentDayOfWeek + 7) % 7
        nextRun.setDate(nextRun.getDate() + (daysToAdd === 0 ? 7 : daysToAdd))
        nextRun.setHours(0, 0, 0, 0)
        changed = true
      }
    }

    // Ajustar hora
    if (hour !== null && nextRun.getHours() !== hour) {
      if (nextRun.getHours() > hour || (nextRun.getHours() === hour && nextRun.getMinutes() >= (minute || 0))) {
        nextRun.setDate(nextRun.getDate() + 1)
        nextRun.setHours(0, 0, 0, 0)
      }
      nextRun.setHours(hour)
      nextRun.setMinutes(minute || 0)
      changed = true
    }

    // Ajustar minuto
    if (minute !== null && nextRun.getMinutes() !== minute) {
      if (nextRun.getMinutes() > minute || changed) {
        nextRun.setHours(nextRun.getHours() + 1)
        nextRun.setMinutes(minute)
      } else {
        nextRun.setMinutes(minute)
      }
      changed = true
    }

    // Verificar se já passou da data de referência
    if (!changed && nextRun <= fromDate) {
      // Avançar para próxima execução
      if (hour === null) {
        nextRun.setMinutes(nextRun.getMinutes() + 1)
      } else if (day === null && dayOfWeek === null && month === null) {
        nextRun.setHours(nextRun.getHours() + 1)
        nextRun.setMinutes(minute || 0)
      } else {
        nextRun.setDate(nextRun.getDate() + 1)
        nextRun.setHours(hour || 0, minute || 0, 0, 0)
      }
      changed = true
    }

    if (!changed) {
      break
    }

    attempts++
  }

  if (attempts >= maxAttempts) {
    throw new Error('Não foi possível calcular próxima execução do cron')
  }

  return nextRun
}

/**
 * Calcula próxima execução baseada em interval
 */
export function calculateNextRunFromInterval(
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly',
  time?: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  fromDate: Date = new Date()
): Date {
  const nextRun = new Date(fromDate)
  nextRun.setSeconds(0)
  nextRun.setMilliseconds(0)

  const [hours, minutes] = time ? time.split(':').map(Number) : [nextRun.getHours(), nextRun.getMinutes()]

  switch (interval) {
    case 'hourly':
      // Próxima hora
      nextRun.setHours(nextRun.getHours() + 1)
      nextRun.setMinutes(minutes || 0)
      break

    case 'daily':
      // Próximo dia no horário especificado
      nextRun.setHours(hours, minutes || 0, 0, 0)
      if (nextRun <= fromDate) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'weekly':
      // Próxima semana no dia e horário especificados
      if (dayOfWeek !== undefined) {
        const currentDayOfWeek = nextRun.getDay()
        let daysToAdd = (dayOfWeek - currentDayOfWeek + 7) % 7

        if (daysToAdd === 0 && (nextRun.getHours() > hours || (nextRun.getHours() === hours && nextRun.getMinutes() >= minutes))) {
          daysToAdd = 7
        }

        nextRun.setDate(nextRun.getDate() + daysToAdd)
        nextRun.setHours(hours, minutes || 0, 0, 0)
      } else {
        nextRun.setDate(nextRun.getDate() + 7)
        nextRun.setHours(hours, minutes || 0, 0, 0)
      }
      break

    case 'monthly':
      // Próximo mês no dia e horário especificados
      const targetDay = dayOfMonth || 1
      const daysInMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()
      const actualDay = Math.min(targetDay, daysInMonth)

      if (nextRun.getDate() < actualDay) {
        nextRun.setDate(actualDay)
        nextRun.setHours(hours, minutes || 0, 0, 0)
      } else {
        nextRun.setMonth(nextRun.getMonth() + 1)
        const nextDaysInMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()
        nextRun.setDate(Math.min(targetDay, nextDaysInMonth))
        nextRun.setHours(hours, minutes || 0, 0, 0)
      }

      if (nextRun <= fromDate) {
        nextRun.setMonth(nextRun.getMonth() + 1)
        const nextDaysInMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()
        nextRun.setDate(Math.min(targetDay, nextDaysInMonth))
      }
      break
  }

  return nextRun
}

/**
 * Calcula próxima execução baseada na configuração do schedule
 */
export function calculateNextRun(
  scheduleConfig: ScheduleConfig,
  fromDate: Date = new Date()
): Date | null {
  const { schedule_type, schedule_config } = scheduleConfig

  switch (schedule_type) {
    case 'cron':
      if (!schedule_config.cron) {
        throw new Error('Cron expression é obrigatória para schedule_type cron')
      }
      return calculateNextRunFromCron(schedule_config.cron, fromDate)

    case 'interval':
      if (!schedule_config.interval) {
        throw new Error('Interval é obrigatório para schedule_type interval')
      }
      return calculateNextRunFromInterval(
        schedule_config.interval,
        schedule_config.time,
        schedule_config.dayOfWeek,
        schedule_config.dayOfMonth,
        fromDate
      )

    case 'webhook':
    case 'event':
      // Webhooks e eventos são executados sob demanda, não têm próxima execução previsível
      return null

    default:
      throw new Error(`Tipo de schedule desconhecido: ${schedule_type}`)
  }
}

/**
 * Formata descrição humana do schedule
 */
export function formatScheduleDescription(scheduleConfig: ScheduleConfig): string {
  const { schedule_type, schedule_config } = scheduleConfig

  switch (schedule_type) {
    case 'cron':
      return `Cron: ${schedule_config.cron}`

    case 'interval':
      const intervalText = {
        hourly: 'A cada hora',
        daily: 'Diariamente',
        weekly: 'Semanalmente',
        monthly: 'Mensalmente',
      }[schedule_config.interval || 'daily'] || schedule_config.interval

      if (schedule_config.time) {
        return `${intervalText} às ${schedule_config.time}`
      }
      return intervalText

    case 'webhook':
      return `Webhook: ${schedule_config.webhook_path}`

    case 'event':
      return `Evento: ${schedule_config.event_type}`

    default:
      return 'Agendamento desconhecido'
  }
}

