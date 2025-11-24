/**
 * Cache simples em memória para memórias do usuário
 * TTL: 5 minutos
 * Invalidado quando memória for atualizada/deletada
 */

interface CachedMemory {
  userId: string
  agentId: string | null
  memories: any[]
  timestamp: number
}

const TTL = 5 * 60 * 1000 // 5 minutos em milissegundos
const cache = new Map<string, CachedMemory>()

/**
 * Gera chave de cache baseada em userId e agentId
 */
function getCacheKey(userId: string, agentId: string | null): string {
  return `${userId}:${agentId || 'global'}`
}

/**
 * Obtém memórias do cache se ainda válidas
 */
export function getCachedMemories(userId: string, agentId: string | null): any[] | null {
  const key = getCacheKey(userId, agentId)
  const cached = cache.get(key)

  if (!cached) {
    return null
  }

  // Verificar se cache expirou
  const now = Date.now()
  if (now - cached.timestamp > TTL) {
    cache.delete(key)
    return null
  }

  return cached.memories
}

/**
 * Armazena memórias no cache
 */
export function setCachedMemories(
  userId: string,
  agentId: string | null,
  memories: any[]
): void {
  const key = getCacheKey(userId, agentId)
  cache.set(key, {
    userId,
    agentId,
    memories,
    timestamp: Date.now(),
  })
}

/**
 * Invalida cache de memórias para um usuário e agente
 */
export function invalidateCache(userId: string, agentId: string | null): void {
  const key = getCacheKey(userId, agentId)
  cache.delete(key)
}

/**
 * Invalida todo o cache de um usuário (global e todos os agentes)
 */
export function invalidateUserCache(userId: string): void {
  const keysToDelete: string[] = []
  cache.forEach((value, key) => {
    if (value.userId === userId) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach((key) => cache.delete(key))
}

/**
 * Limpa cache expirado
 */
export function cleanExpiredCache(): void {
  const now = Date.now()
  const keysToDelete: string[] = []

  cache.forEach((value, key) => {
    if (now - value.timestamp > TTL) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach((key) => cache.delete(key))
}

// Limpar cache expirado a cada 10 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(cleanExpiredCache, 10 * 60 * 1000)
}

