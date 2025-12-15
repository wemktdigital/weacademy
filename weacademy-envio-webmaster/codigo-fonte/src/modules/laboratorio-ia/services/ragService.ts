/**
 * Serviço de RAG (Retrieval Augmented Generation)
 * Busca contexto relevante na knowledge base e injeta nos prompts
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from './embeddingService'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface RAGContext {
  chunks: Array<{
    content: string
    document_id: string
    document_filename: string
    similarity: number
    metadata?: any
  }>
  totalResults: number
}

/**
 * Busca contexto relevante na knowledge base usando busca semântica
 */
export async function searchKnowledgeBase(
  query: string,
  options?: {
    knowledgeBaseId?: string
    agentId?: string
    similarityThreshold?: number
    maxResults?: number
  }
): Promise<RAGContext> {
  const {
    knowledgeBaseId,
    agentId,
    similarityThreshold = 0.7,
    maxResults = 5,
  } = options || {}

  // Gerar embedding da query
  const queryEmbedding = await generateEmbedding(query)

  // Determinar knowledge bases para buscar
  let knowledgeBaseIds: string[] = []

  if (knowledgeBaseId) {
    // Buscar na knowledge base específica
    knowledgeBaseIds = [knowledgeBaseId]
  } else if (agentId) {
    // Buscar em knowledge bases do agente
    const { data: agentKBs } = await serviceSupabase
      .from('lab_knowledge_bases')
      .select('id')
      .eq('agent_id', agentId)
      .eq('enabled', true)

    if (agentKBs) {
      knowledgeBaseIds = agentKBs.map(kb => kb.id)
    }
  } else {
    // Buscar em knowledge bases globais
    const { data: globalKBs } = await serviceSupabase
      .from('lab_knowledge_bases')
      .select('id')
      .eq('is_global', true)
      .eq('enabled', true)

    if (globalKBs) {
      knowledgeBaseIds = globalKBs.map(kb => kb.id)
    }
  }

  if (knowledgeBaseIds.length === 0) {
    return {
      chunks: [],
      totalResults: 0,
    }
  }

  // Buscar em cada knowledge base e combinar resultados
  const allResults: any[] = []

  for (const kbId of knowledgeBaseIds) {
    try {
      const { data, error } = await serviceSupabase.rpc('search_knowledge_base', {
        query_embedding: queryEmbedding,
        knowledge_base_id: kbId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults,
      })

      if (error) {
        console.error(`[RAG Service] Erro ao buscar na KB ${kbId}:`, error)
        continue
      }

      if (data) {
        allResults.push(...data)
      }
    } catch (error) {
      console.error(`[RAG Service] Erro ao buscar na KB ${kbId}:`, error)
      continue
    }
  }

  // Ordenar por similaridade e limitar resultados
  allResults.sort((a, b) => b.similarity - a.similarity)
  const topResults = allResults.slice(0, maxResults)

  return {
    chunks: topResults.map((result: any) => ({
      content: result.content,
      document_id: result.document_id,
      document_filename: result.document_filename,
      similarity: result.similarity,
      metadata: result.metadata,
    })),
    totalResults: allResults.length,
  }
}

/**
 * Formata contexto RAG para injetar no prompt
 */
export function formatRAGContext(ragContext: RAGContext): string {
  if (ragContext.chunks.length === 0) {
    return ''
  }

  const contextParts = ragContext.chunks.map((chunk, index) => {
    return `[Contexto ${index + 1} - ${chunk.document_filename}]
${chunk.content}
(Similaridade: ${(chunk.similarity * 100).toFixed(1)}%)`
  })

  return `
## Contexto Relevante da Knowledge Base:

${contextParts.join('\n\n---\n\n')}

---

Use o contexto acima para informar sua resposta. Se o contexto não for relevante para a pergunta, você pode ignorá-lo.
`
}

/**
 * Injeta contexto RAG em um prompt ou mensagem
 */
export function injectRAGContext(
  originalPrompt: string,
  ragContext: RAGContext
): string {
  if (ragContext.chunks.length === 0) {
    return originalPrompt
  }

  const contextText = formatRAGContext(ragContext)
  return originalPrompt + contextText
}

