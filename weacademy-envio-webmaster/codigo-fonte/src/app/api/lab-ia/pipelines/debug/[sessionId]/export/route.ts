import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getDebugSession, exportSessionState } from '@/modules/laboratorio-ia/services/debugMode'

/**
 * GET /api/lab-ia/pipelines/debug/[sessionId]/export
 * Exporta o estado da sessão como JSON
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const exportedState = await exportSessionState(sessionId)

    return new NextResponse(exportedState, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="debug-session-${sessionId}.json"`,
      },
    })
  } catch (error: any) {
    console.error('[Debug API] Erro ao exportar:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

