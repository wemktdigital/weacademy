import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await supabaseServer()
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (token) {
    const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
    if (!tokenError && tokenUser) {
      return tokenUser
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const serviceSupabase = getServiceClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const workflowId = searchParams.get('workflow_id')

    let query = serviceSupabase
      .from('lab_workflow_versions')
      .select('id, version_label, is_active, workflow_id, created_at, workflow:lab_workflows(id, name)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }

    const { data: versions, error } = await query

    if (error) {
      console.error('[WorkflowVersions][GET] erro:', error)
      return NextResponse.json({ error: 'Erro ao listar versões' }, { status: 400 })
    }

    return NextResponse.json({ versions: versions || [] })
  } catch (error: any) {
    console.error('[WorkflowVersions][GET] falha inesperada:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}


