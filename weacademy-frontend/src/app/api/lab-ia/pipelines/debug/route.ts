import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { 
  createDebugSession, 
  getDebugSession,
  updateDebugSession,
  pauseAtStep,
  continueExecution,
  stopExecution,
  shouldPauseAtStep,
  addExecutedStep,
  createSnapshot,
  getSnapshots,
  exportSessionState,
} from '@/modules/laboratorio-ia/services/debugMode'
import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'

/**
 * POST /api/lab-ia/pipelines/debug
 * Inicia uma nova sessão de debug
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { pipelineId, messages, breakpoints = [] } = body

    if (!pipelineId || !messages) {
      return NextResponse.json(
        { error: 'pipelineId e messages são obrigatórios' },
        { status: 400 }
      )
    }

    // Criar sessão de debug
    const session = await createDebugSession(
      pipelineId,
      user.id,
      messages,
      breakpoints
    )

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error: any) {
    console.error('[Debug API] Erro ao criar sessão:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/lab-ia/pipelines/debug?sessionId=...
 * Busca uma sessão de debug
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId é obrigatório' },
        { status: 400 }
      )
    }

    const session = await getDebugSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o usuário tem acesso
    if (session.user_id !== user.id) {
      // Verificar se é admin
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'gestor_we', 'gestor'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({
      session,
    })
  } catch (error: any) {
    console.error('[Debug API] Erro ao buscar sessão:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

