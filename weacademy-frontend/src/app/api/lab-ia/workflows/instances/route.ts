import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: publishedBluePrints } = await supabase
      .from('lab_workflow_blueprints')
      .select('published_workflow_version_id')
      .eq('owner_user_id', user.id)
      .not('published_workflow_version_id', 'is', null)

    const workflowVersionIds = (publishedBluePrints || [])
      .map((item) => item.published_workflow_version_id)
      .filter(Boolean) as string[]

    const query = supabase
      .from('lab_workflow_instances')
      .select('*, workflow:lab_workflows(name)')
      .eq('owner_user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50)

    if (workflowVersionIds.length > 0) {
      query.in('workflow_version_id', workflowVersionIds)
    }

    const { data, error: listError } = await query

    if (listError) {
      throw listError
    }

    return NextResponse.json({ success: true, instances: data || [] })
  } catch (err: any) {
    console.error('[Workflows][List] Erro ao listar instâncias:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao listar instâncias' }, { status: 500 })
  }
}

