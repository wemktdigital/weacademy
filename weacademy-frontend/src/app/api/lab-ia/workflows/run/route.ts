import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createWorkflowInstance, processWorkflowInstance } from '@/modules/laboratorio-ia/services/workflowOrchestrator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workflowVersionId, context = {}, metadata = {} } = body

    if (!workflowVersionId) {
      return NextResponse.json({ error: 'workflowVersionId é obrigatório' }, { status: 400 })
    }

    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const instance = await createWorkflowInstance({
      workflowVersionId,
      ownerUserId: user.id,
      context,
      metadata,
    })

    await processWorkflowInstance(instance.id)

    return NextResponse.json({ success: true, instance })
  } catch (error: any) {
    console.error('[Workflows][Run] Erro ao iniciar workflow:', error)
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}

