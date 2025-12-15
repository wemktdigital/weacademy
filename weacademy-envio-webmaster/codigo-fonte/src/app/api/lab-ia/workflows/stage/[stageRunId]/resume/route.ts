import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resumeWorkflowStage } from '@/modules/laboratorio-ia/services/workflowOrchestrator'

interface Params {
  params: {
    stageRunId: string
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { stageRunId } = params
    if (!stageRunId) {
      return NextResponse.json({ error: 'stageRunId é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { submission } = body

    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await resumeWorkflowStage({
      stageRunId,
      submission,
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Workflows][Resume] Erro ao retomar etapa:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao retomar etapa' }, { status: 500 })
  }
}

