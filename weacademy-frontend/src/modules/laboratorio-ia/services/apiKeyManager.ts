/**
 * Gerenciador de API keys e rate limiting
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const API_KEY_PREFIX = 'wak_'

/**
 * Gera uma nova API key
 */
export function generateApiKey(): string {
  // Gerar 32 bytes aleatórios
  const randomBytes = crypto.randomBytes(32)
  // Converter para base64url (URL-safe)
  const randomPart = randomBytes.toString('base64url').substring(0, 43) // 43 chars = ~32 bytes
  return `${API_KEY_PREFIX}${randomPart}`
}

/**
 * Calcula hash SHA-256 da API key para armazenamento seguro
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

/**
 * Valida se uma string parece ser uma API key válida
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith(API_KEY_PREFIX) && apiKey.length > API_KEY_PREFIX.length + 20
}

/**
 * Verifica se uma API key é válida e retorna seus dados
 */
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean
  apiKeyData?: {
    id: string
    user_id: string
    pipeline_id: string
    name: string
    enabled: boolean
    rate_limits: {
      per_minute: number
      per_hour: number
      per_day: number
    }
    expires_at?: string
  }
  error?: string
}> {
  if (!isValidApiKeyFormat(apiKey)) {
    return { valid: false, error: 'Invalid API key format' }
  }

  const keyHash = hashApiKey(apiKey)

  // Usar service role para bypass RLS
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apiKeyData, error } = await serviceSupabase
    .from('lab_pipeline_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single()

  if (error || !apiKeyData) {
    return { valid: false, error: 'API key not found' }
  }

  // Verificar se está habilitada
  if (!apiKeyData.enabled) {
    return { valid: false, error: 'API key is disabled' }
  }

  // Verificar se expirou
  if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' }
  }

  return {
    valid: true,
    apiKeyData: {
      id: apiKeyData.id,
      user_id: apiKeyData.user_id,
      pipeline_id: apiKeyData.pipeline_id,
      name: apiKeyData.name,
      enabled: apiKeyData.enabled,
      rate_limits: {
        per_minute: apiKeyData.rate_limit_per_minute,
        per_hour: apiKeyData.rate_limit_per_hour,
        per_day: apiKeyData.rate_limit_per_day,
      },
      expires_at: apiKeyData.expires_at,
    },
  }
}

/**
 * Verifica rate limiting para uma API key
 */
export async function checkRateLimit(
  apiKeyId: string,
  now: Date = new Date()
): Promise<{
  allowed: boolean
  remaining: {
    minute: number
    hour: number
    day: number
  }
  resetAt: {
    minute: Date
    hour: Date
    day: Date
  }
  error?: string
}> {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Buscar limites da API key
  const { data: apiKeyData } = await serviceSupabase
    .from('lab_pipeline_api_keys')
    .select('rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day')
    .eq('id', apiKeyId)
    .single()

  if (!apiKeyData) {
    return {
      allowed: false,
      remaining: { minute: 0, hour: 0, day: 0 },
      resetAt: {
        minute: now,
        hour: now,
        day: now,
      },
      error: 'API key not found',
    }
  }

  // Calcular janelas de tempo
  const minuteStart = new Date(now)
  minuteStart.setSeconds(0, 0)
  const hourStart = new Date(now)
  hourStart.setMinutes(0, 0, 0)
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)

  const nextMinute = new Date(minuteStart)
  nextMinute.setMinutes(nextMinute.getMinutes() + 1)
  const nextHour = new Date(hourStart)
  nextHour.setHours(nextHour.getHours() + 1)
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)

  // Contar requests em cada janela
  const [minuteCount, hourCount, dayCount] = await Promise.all([
    serviceSupabase
      .from('lab_pipeline_api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', minuteStart.toISOString()),
    
    serviceSupabase
      .from('lab_pipeline_api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', hourStart.toISOString()),
    
    serviceSupabase
      .from('lab_pipeline_api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', dayStart.toISOString()),
  ])

  const minuteRemaining = Math.max(0, apiKeyData.rate_limit_per_minute - (minuteCount.count || 0))
  const hourRemaining = Math.max(0, apiKeyData.rate_limit_per_hour - (hourCount.count || 0))
  const dayRemaining = Math.max(0, apiKeyData.rate_limit_per_day - (dayCount.count || 0))

  const allowed = minuteRemaining > 0 && hourRemaining > 0 && dayRemaining > 0

  return {
    allowed,
    remaining: {
      minute: minuteRemaining,
      hour: hourRemaining,
      day: dayRemaining,
    },
    resetAt: {
      minute: nextMinute,
      hour: nextHour,
      day: nextDay,
    },
    error: allowed ? undefined : 'Rate limit exceeded',
  }
}

/**
 * Registra uso de API
 */
export async function recordApiUsage(
  apiKeyId: string,
  pipelineId: string,
  requestMethod: string,
  requestPath: string,
  responseStatus: number,
  options?: {
    responseTimeMs?: number
    tokensUsed?: number
    costUsd?: number
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Registrar uso
  await serviceSupabase
    .from('lab_pipeline_api_usage')
    .insert({
      api_key_id: apiKeyId,
      pipeline_id: pipelineId,
      request_method: requestMethod,
      request_path: requestPath,
      response_status: responseStatus,
      response_time_ms: options?.responseTimeMs,
      tokens_used: options?.tokensUsed,
      cost_usd: options?.costUsd,
      ip_address: options?.ipAddress,
      user_agent: options?.userAgent,
    })

  // Atualizar estatísticas da API key (incrementar total_requests e atualizar last_used_at)
  const { data: current } = await serviceSupabase
    .from('lab_pipeline_api_keys')
    .select('total_requests')
    .eq('id', apiKeyId)
    .single()

  if (current) {
    await serviceSupabase
      .from('lab_pipeline_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        total_requests: (current.total_requests || 0) + 1,
      })
      .eq('id', apiKeyId)
  }
}
