import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API route para verificar status de uma operação de vídeo específica
 * 
 * GET /api/lab-ia/videos/status/[operationId]
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ operationId: string }> }
) {
  const params = await props.params
  try {
    const operationId = params.operationId

    if (!operationId) {
      return NextResponse.json(
        { error: 'operationId é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar autenticação via header Authorization
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Buscar operação no banco
    const { data: operation, error: fetchError } = await supabase
      .from('lab_video_operations')
      .select('*')
      .eq('id', operationId)
      .eq('user_id', user.id) // Garantir que o usuário só acesse suas próprias operações
      .single()

    if (fetchError || !operation) {
      return NextResponse.json(
        { error: 'Operação não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: operation.id,
      status: operation.status,
      model: operation.model,
      prompt: operation.prompt,
      video_url: operation.video_url,
      video_data_url: operation.video_data_url,
      error_message: operation.error_message,
      created_at: operation.created_at,
      updated_at: operation.updated_at,
      completed_at: operation.completed_at,
    })

  } catch (error: any) {
    console.error('[VIDEO-STATUS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar status da operação', details: error.message },
      { status: 500 }
    )
  }
}

