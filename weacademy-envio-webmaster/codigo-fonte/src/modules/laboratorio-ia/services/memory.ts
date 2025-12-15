import { createClient } from '@/lib/supabase'
import { getCachedMemories, setCachedMemories, invalidateCache, invalidateUserCache } from '@/lib/cache/memoryCache'

export interface MemoryItem {
  key: string
  value: string
  importance: number
}

export interface MemoryProfile {
  global: MemoryItem[]
  agent: MemoryItem[]
}

/**
 * Salva ou atualiza uma memória
 */
export async function remember({
  userId,
  agentId,
  key,
  value,
  importance = 1,
}: {
  userId: string
  agentId?: string | null
  key: string
  value: string
  importance?: number
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('lab_agent_memory')
    .upsert(
      {
        user_id: userId,
        agent_id: agentId || null,
        key,
        value,
        importance,
      },
      {
        onConflict: 'user_id,agent_id,key',
        ignoreDuplicates: false,
      }
    )

  if (error) {
    throw new Error(`Failed to remember: ${error.message}`)
  }

  // Invalidar cache após salvar/atualizar memória
  invalidateCache(userId, agentId || null)
}

/**
 * Recupera perfil de memória (global + agente específico)
 */
export async function recallProfile({
  userId,
  agentId,
}: {
  userId: string
  agentId?: string
}): Promise<MemoryProfile> {
  // Tentar obter do cache primeiro
  const cachedGlobal = getCachedMemories(userId, null)
  const cachedAgent = agentId ? getCachedMemories(userId, agentId) : null

  // Se ambos estiverem no cache, retornar direto
  if (cachedGlobal && (agentId ? cachedAgent !== null : true)) {
    return {
      global: cachedGlobal as MemoryItem[],
      agent: (cachedAgent as MemoryItem[]) || [],
    }
  }

  const supabase = await createClient()

  // Memória global (sem agentId)
  let globalMem: MemoryItem[] = []
  if (cachedGlobal) {
    globalMem = cachedGlobal as MemoryItem[]
  } else {
    const { data, error: globalError } = await supabase
      .from('lab_agent_memory')
      .select('key, value, importance')
      .eq('user_id', userId)
      .is('agent_id', null)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(20)

    if (globalError) {
      console.error('Error fetching global memories:', globalError)
    } else {
      globalMem = data || []
      setCachedMemories(userId, null, globalMem)
    }
  }

  let agentMem: any[] = []
  if (agentId) {
    if (cachedAgent) {
      agentMem = cachedAgent as MemoryItem[]
    } else {
      // Memória do agente específico
      const { data, error: agentError } = await supabase
        .from('lab_agent_memory')
        .select('key, value, importance')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(20)

      if (agentError) {
        console.error('Error fetching agent memories:', agentError)
      } else {
        agentMem = data || []
        setCachedMemories(userId, agentId, agentMem)
      }
    }
  }

  return {
    global: globalMem,
    agent: agentMem,
  }
}

/**
 * Recupera apenas memória global
 */
export async function recallGlobal(userId: string): Promise<MemoryItem[]> {
  // Tentar obter do cache primeiro
  const cached = getCachedMemories(userId, null)
  if (cached) {
    return cached as MemoryItem[]
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lab_agent_memory')
    .select('key, value, importance')
    .eq('user_id', userId)
    .is('agent_id', null)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching global memories:', error)
    return []
  }

  const memories = data || []
  
  // Armazenar no cache
  setCachedMemories(userId, null, memories)

  return memories
}

/**
 * Busca resumos recentes de conversas
 */
export async function getRecentSummaries({
  userId,
  agentId,
  conversationId,
  limit = 2,
}: {
  userId: string
  agentId?: string
  conversationId?: string
  limit?: number
}): Promise<string[]> {
  const supabase = await createClient()

  let query = supabase
    .from('lab_conversation_summaries')
    .select('summary')
    .eq('user_id', userId)

  if (conversationId) {
    query = query.eq('conversation_id', conversationId)
  }

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching summaries:', error)
    return []
  }

  return (data || []).map((item) => item.summary)
}

/**
 * Deleta uma memória
 */
export async function forget({
  userId,
  agentId,
  key,
}: {
  userId: string
  agentId?: string | null
  key: string
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('lab_agent_memory')
    .delete()
    .eq('user_id', userId)
    .eq('key', key)
    .eq('agent_id', agentId || null)

  if (error) {
    throw new Error(`Failed to forget: ${error.message}`)
  }

  // Invalidar cache após deletar memória
  invalidateCache(userId, agentId || null)
}

/**
 * Limpa todas as memórias do usuário
 */
export async function clearAllMemories({
  userId,
  agentId,
}: {
  userId: string
  agentId?: string | null
}) {
  const supabase = await createClient()

  let query = supabase.from('lab_agent_memory').delete().eq('user_id', userId)

  if (agentId !== undefined) {
    query = query.eq('agent_id', agentId || null)
  }

  const { error } = await query

  if (error) {
    throw new Error(`Failed to clear memories: ${error.message}`)
  }

  // Invalidar cache após limpar memórias
  if (agentId !== undefined) {
    invalidateCache(userId, agentId || null)
  } else {
    invalidateUserCache(userId)
  }
}

/**
 * Lista todas as memórias do usuário
 */
export async function listMemories({
  userId,
  agentId,
}: {
  userId: string
  agentId?: string | null
}) {
  const supabase = await createClient()

  let query = supabase
    .from('lab_agent_memory')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (agentId !== undefined) {
    query = query.eq('agent_id', agentId || null)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list memories: ${error.message}`)
  }

  return data || []
}

/**
 * Formata memórias para serem usadas no contexto do LLM, respeitando limite de tokens
 * Prioriza memórias por importância
 */
export function formatMemoriesForContext(
  memories: MemoryItem[],
  maxTokens: number = 1000
): string {
  if (!memories || memories.length === 0) {
    return ''
  }

  // Estimar tokens: ~1 palavra = 1.3 tokens (aproximação)
  // Função auxiliar para estimar tokens
  const estimateTokens = (text: string): number => {
    const words = text.trim().split(/\s+/).length
    return Math.ceil(words * 1.3)
  }

  // Ordenar por importância (maior primeiro)
  const sortedMemories = [...memories].sort((a, b) => b.importance - a.importance)

  // Construir contexto respeitando limite de tokens
  const lines: string[] = []
  let currentTokens = 0
  const header = '[Memórias do Usuário]'
  const headerTokens = estimateTokens(header)
  const footer = '\nUse essas informações para personalizar suas respostas.'
  const footerTokens = estimateTokens(footer)
  const reservedTokens = headerTokens + footerTokens

  let availableTokens = maxTokens - reservedTokens

  for (const memory of sortedMemories) {
    const line = `- ${memory.key}: ${memory.value}`
    const lineTokens = estimateTokens(line)

    if (currentTokens + lineTokens <= availableTokens) {
      lines.push(line)
      currentTokens += lineTokens
    } else {
      // Parar se não couber mais
      break
    }
  }

  if (lines.length === 0) {
    return ''
  }

  return `${header}\n${lines.join('\n')}${footer}`
}
