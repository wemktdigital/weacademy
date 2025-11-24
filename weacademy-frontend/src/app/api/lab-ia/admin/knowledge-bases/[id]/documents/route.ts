import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { processDocument, detectFileType, chunkText } from '@/modules/laboratorio-ia/services/documentProcessor'
import { generateEmbeddingsBatch } from '@/modules/laboratorio-ia/services/embeddingService'

/**
 * POST /api/lab-ia/admin/knowledge-bases/[id]/documents
 * Upload e processa um documento na knowledge base
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: knowledgeBaseId } = await params

    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se knowledge base existe e usuário tem acesso
    const { data: knowledgeBase } = await serviceSupabase
      .from('lab_knowledge_bases')
      .select('*')
      .eq('id', knowledgeBaseId)
      .single()

    if (!knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile && profile.role === 'admin'
    if (knowledgeBase.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Obter arquivo do FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Detectar tipo de arquivo
    const fileType = detectFileType(file.name, file.type)
    if (!fileType) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: PDF, TXT, DOCX, MD' },
        { status: 400 }
      )
    }

    // Criar registro do documento
    const { data: document, error: docError } = await serviceSupabase
      .from('lab_knowledge_documents')
      .insert({
        knowledge_base_id: knowledgeBaseId,
        filename: file.name,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.type,
        processing_status: 'processing',
      })
      .select()
      .single()

    if (docError) {
      console.error('[Documents API] Erro ao criar documento:', docError)
      throw docError
    }

    // Processar documento em background (usar setImmediate para não bloquear resposta)
    setImmediate(async () => {
      try {
        // Extrair conteúdo do documento
        const processed = await processDocument(file, fileType)

        // Dividir em chunks
        const chunks = chunkText(
          processed.content,
          knowledgeBase.chunk_size || 1000,
          knowledgeBase.chunk_overlap || 200
        )

        console.log(`[Documents API] Documento ${document.id} processado: ${chunks.length} chunks gerados`)

        // Gerar embeddings para todos os chunks em batch
        const embeddings = await generateEmbeddingsBatch(chunks)

        // Atualizar documento com conteúdo processado
        await serviceSupabase
          .from('lab_knowledge_documents')
          .update({
            raw_content: processed.content,
            metadata: processed.metadata,
            processing_status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', document.id)

        // Inserir chunks com embeddings
        const chunksToInsert = chunks.map((chunk, index) => ({
          document_id: document.id,
          knowledge_base_id: knowledgeBaseId,
          content: chunk,
          chunk_index: index,
          embedding: embeddings[index],
          start_char: index * (knowledgeBase.chunk_size || 1000),
          end_char: Math.min((index + 1) * (knowledgeBase.chunk_size || 1000), processed.content.length),
          metadata: {
            chunk_index: index,
            total_chunks: chunks.length,
          },
        }))

        // Inserir chunks em batches de 100
        for (let i = 0; i < chunksToInsert.length; i += 100) {
          const batch = chunksToInsert.slice(i, i + 100)
          await serviceSupabase
            .from('lab_knowledge_chunks')
            .insert(batch)
        }

        console.log(`[Documents API] Documento ${document.id} indexado com sucesso`)
      } catch (error: any) {
        console.error(`[Documents API] Erro ao processar documento ${document.id}:`, error)

        // Atualizar documento com erro
        await serviceSupabase
          .from('lab_knowledge_documents')
          .update({
            processing_status: 'failed',
            error_message: error.message || 'Unknown error',
          })
          .eq('id', document.id)
      }
    })

    // Retornar resposta imediata
    return NextResponse.json({
      success: true,
      document: {
        ...document,
        processing_status: 'processing',
      },
      message: 'Document uploaded and processing started',
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Documents API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/lab-ia/admin/knowledge-bases/[id]/documents
 * Lista documentos de uma knowledge base
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: knowledgeBaseId } = await params

    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar documentos
    const { data: documents, error } = await serviceSupabase
      .from('lab_knowledge_documents')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Documents API] Erro ao buscar documentos:', error)
      throw error
    }

    return NextResponse.json({
      documents: documents || [],
    })
  } catch (error: any) {
    console.error('[Documents API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

