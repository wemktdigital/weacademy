/**
 * Serviço de embeddings para Knowledge Base
 * Gera embeddings usando OpenAI
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Gera embedding para um texto usando OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensões
      input: text,
    })

    return response.data[0].embedding
  } catch (error: any) {
    console.error('[Embedding Service] Erro ao gerar embedding:', error)
    throw new Error(`Erro ao gerar embedding: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Gera embeddings para múltiplos textos em batch
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      })

      const batchEmbeddings = response.data.map(item => item.embedding)
      embeddings.push(...batchEmbeddings)
    } catch (error: any) {
      console.error(`[Embedding Service] Erro no batch ${i}-${i + batch.length}:`, error)
      // Para este batch, gerar embeddings vazios ou lançar erro
      throw new Error(`Erro ao gerar embeddings no batch ${i}: ${error.message || 'Unknown error'}`)
    }
  }

  return embeddings
}

