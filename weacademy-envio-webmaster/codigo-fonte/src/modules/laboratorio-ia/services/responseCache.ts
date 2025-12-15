// Sistema de Cache LRU para respostas frequentes
// Evita chamadas desnecessárias para prompts similares

interface CacheEntry {
  key: string
  response: string
  provider: string
  model: string
  timestamp: number
  cost: number
  latency: number
}

class LRUCache {
  private cache: Map<string, CacheEntry>
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * Gera chave de cache baseada no prompt e modelo
   */
  private generateKey(prompt: string, provider: string, model: string): string {
    // Normalizar prompt (remover espaços extras, lowercase)
    const normalized = prompt.toLowerCase().trim().replace(/\s+/g, ' ')
    return `${provider}:${model}:${normalized.substring(0, 200)}` // Limitar tamanho da chave
  }

  /**
   * Verifica se há cache para um prompt
   */
  get(prompt: string, provider: string, model: string): CacheEntry | null {
    const key = this.generateKey(prompt, provider, model)
    const entry = this.cache.get(key)

    if (!entry) return null

    // Verificar se cache expirou (24 horas)
    const now = Date.now()
    const age = now - entry.timestamp
    const maxAge = 24 * 60 * 60 * 1000 // 24 horas

    if (age > maxAge) {
      this.cache.delete(key)
      return null
    }

    // Mover para o final (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry
  }

  /**
   * Armazena resposta no cache
   */
  set(
    prompt: string,
    provider: string,
    model: string,
    response: string,
    cost: number,
    latency: number
  ): void {
    const key = this.generateKey(prompt, provider, model)
    
    // Se já existe, atualizar
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Se cache está cheio, remover o mais antigo (primeiro no Map)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const entry: CacheEntry = {
      key,
      response,
      provider,
      model,
      timestamp: Date.now(),
      cost,
      latency,
    }

    this.cache.set(key, entry)
  }

  /**
   * Limpa o cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.values()).map(e => ({
        key: e.key.substring(0, 50),
        provider: e.provider,
        model: e.model,
        age: Date.now() - e.timestamp,
      })),
    }
  }
}

// Cache global
export const responseCache = new LRUCache(100)

/**
 * Verifica se há cache para um prompt
 */
export function getCachedResponse(
  prompt: string,
  provider: string,
  model: string
): CacheEntry | null {
  return responseCache.get(prompt, provider, model)
}

/**
 * Armazena resposta no cache
 */
export function cacheResponse(
  prompt: string,
  provider: string,
  model: string,
  response: string,
  cost: number,
  latency: number
): void {
  responseCache.set(prompt, provider, model, response, cost, latency)
}

