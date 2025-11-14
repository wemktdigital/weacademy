import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import {
  getDebugSession,
  updateDebugSession,
  pauseAtStep,
  continueExecution,
  stopExecution,
  addExecutedStep,
  createSnapshot,
  getSnapshots,
  exportSessionState,
} from '@/modules/laboratorio-ia/services/debugMode'
import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'

/**
 * GET /api/lab-ia/pipelines/debug/[sessionId]
 * Busca uma sessão de debug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

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

    const session = await getDebugSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar acesso
    if (session.user_id !== user.id) {
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

    // Buscar snapshots se solicitado
    const { searchParams } = new URL(request.url)
    const includeSnapshots = searchParams.get('snapshots') === 'true'

    let snapshots = []
    if (includeSnapshots) {
      snapshots = await getSnapshots(sessionId)
    }

    return NextResponse.json({
      session,
      snapshots: includeSnapshots ? snapshots : undefined,
    })
  } catch (error: any) {
    console.error('[Debug API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/lab-ia/pipelines/debug/[sessionId]
 * Atualiza sessão de debug (pause, continue, step forward, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

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

    const session = await getDebugSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar acesso
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, stepOrder, contextBefore, contextAfter, contextState, variableContext } = body

    switch (action) {
      case 'pause':
        if (stepOrder !== undefined && contextBefore && contextAfter) {
          const updatedSession = await pauseAtStep(sessionId, stepOrder, contextBefore, contextAfter)
          return NextResponse.json({ success: true, session: updatedSession })
        }
        return NextResponse.json(
          { error: 'stepOrder, contextBefore e contextAfter são obrigatórios para pause' },
          { status: 400 }
        )

      case 'continue':
        const continuedSession = await continueExecution(sessionId)
        return NextResponse.json({ success: true, session: continuedSession })

      case 'stop':
        const stoppedSession = await stopExecution(sessionId)
        return NextResponse.json({ success: true, session: stoppedSession })

      case 'update_context':
        if (!contextState && !variableContext) {
          return NextResponse.json(
            { error: 'contextState ou variableContext deve ser fornecido' },
            { status: 400 }
          )
        }
        const updateData: any = {}
        if (contextState !== undefined) {
          updateData.context_state = contextState
        }
        if (variableContext !== undefined) {
          updateData.variable_context = variableContext
        }
        const updatedSession = await updateDebugSession(sessionId, updateData)
        return NextResponse.json({ success: true, session: updatedSession })

      case 'step_forward':
        // Continuar execução para o próximo step
        const forwardSession = await continueExecution(sessionId)
        return NextResponse.json({ success: true, session: forwardSession })

      default:
        return NextResponse.json(
          { error: 'Ação inválida. Use: pause, continue, stop, update_context, step_forward' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Debug API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/pipelines/debug/[sessionId]/snapshot
 * Cria um snapshot do estado atual
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

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

    const session = await getDebugSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar acesso
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { stepOrder, notes } = body

    if (stepOrder === undefined) {
      return NextResponse.json(
        { error: 'stepOrder é obrigatório' },
        { status: 400 }
      )
    }

    const snapshot = await createSnapshot(sessionId, stepOrder, notes)

    return NextResponse.json({
      success: true,
      snapshot,
    })
  } catch (error: any) {
    console.error('[Debug API] Erro ao criar snapshot:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


