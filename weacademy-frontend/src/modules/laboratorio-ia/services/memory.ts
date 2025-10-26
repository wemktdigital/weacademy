import { createClient } from '@/lib/supabase'

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
  const supabase = await createClient()

  // Memória global (sem agentId)
  const { data: globalMem, error: globalError } = await supabase
    .from('lab_agent_memory')
    .select('key, value, importance')
    .eq('user_id', userId)
    .is('agent_id', null)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(20)

  if (globalError) {
    console.error('Error fetching global memories:', globalError)
  }

  let agentMem: any[] = []
  if (agentId) {
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
    }
  }

  return {
    global: globalMem || [],
    agent: agentMem,
  }
}

/**
 * Recupera apenas memória global
 */
export async function recallGlobal(userId: string): Promise<MemoryItem[]> {
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

  return data || []
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
