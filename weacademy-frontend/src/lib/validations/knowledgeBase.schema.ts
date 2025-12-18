import { z } from 'zod'

export const knowledgeBaseSchema = z.object({
  agent_id: z.string().uuid().optional().nullable(), // null = global
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  is_global: z.boolean().default(false),
  chunk_size: z.number().int().positive().max(5000).optional().default(1000),
  chunk_overlap: z.number().int().nonnegative().max(1000).optional().default(200),
  enabled: z.boolean().default(true),
}).passthrough()

export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema> & {
  id?: string
  user_id?: string
  total_documents?: number
  total_chunks?: number
  created_at?: string
  updated_at?: string
}

export type KnowledgeBaseFormData = z.infer<typeof knowledgeBaseSchema>

// Schema para documento
export const knowledgeDocumentSchema = z.object({
  knowledge_base_id: z.string().uuid(),
  filename: z.string().min(1),
  file_type: z.enum(['pdf', 'txt', 'docx', 'md']),
  file_size: z.number().int().positive().optional(),
  file_url: z.string().url().optional(),
  mime_type: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).passthrough()

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema> & {
  id?: string
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  raw_content?: string
  created_at?: string
  updated_at?: string
  processed_at?: string
}

// Schema para chunk
export const knowledgeChunkSchema = z.object({
  document_id: z.string().uuid(),
  knowledge_base_id: z.string().uuid(),
  content: z.string().min(1),
  chunk_index: z.number().int().nonnegative(),
  embedding: z.array(z.number()).optional(), // Array de 1536 números
  start_char: z.number().int().nonnegative().optional(),
  end_char: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).passthrough()

export type KnowledgeChunk = z.infer<typeof knowledgeChunkSchema> & {
  id?: string
  created_at?: string
}

// Schema para busca semântica
export const semanticSearchSchema = z.object({
  query: z.string().min(1, 'Query é obrigatória'),
  knowledge_base_id: z.string().uuid().optional(), // Se não fornecido, busca em knowledge bases globais
  agent_id: z.string().uuid().optional(), // Buscar em knowledge bases específicas do agente
  similarity_threshold: z.number().min(0).max(1).optional().default(0.7),
  max_results: z.number().int().positive().max(20).optional().default(5),
}).passthrough()

export type SemanticSearch = z.infer<typeof semanticSearchSchema>

// Schema para resultado de busca
export const searchResultSchema = z.object({
  chunk_id: z.string().uuid(),
  content: z.string(),
  document_id: z.string().uuid(),
  document_filename: z.string(),
  similarity: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type SearchResult = z.infer<typeof searchResultSchema>

