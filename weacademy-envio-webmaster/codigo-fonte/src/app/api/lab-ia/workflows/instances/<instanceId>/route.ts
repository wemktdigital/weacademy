import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

interface Params {
  params: {
    instanceId: string
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { instanceId } = params
    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 })
    }

    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: instance, error: instanceError } = await supabase
      .from('lab_workflow_instances')
      .select('*, workflow:lab_workflows(name)')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    if (instance.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data: stages } = await supabase
      .from('lab_workflow_stages')
      .select('*')
      .eq('workflow_version_id', instance.workflow_version_id)

    const { data: stageRuns } = await supabase
      .from('lab_workflow_stage_runs')
      .select('*')
      .eq('workflow_instance_id', instanceId)
      .order('created_at', { ascending: true })

    const { data: events } = await supabase
      .from('lab_workflow_events')
      .select('*')
      .eq('workflow_instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      instance,
      stages: stages || [],
      stageRuns: stageRuns || [],
      events: events || [],
    })
  } catch (err: any) {
    console.error('[Workflows][Detail] Erro ao carregar instância:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao carregar instância' }, { status: 500 })
  }
}

