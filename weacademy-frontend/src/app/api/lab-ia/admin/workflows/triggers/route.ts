import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

const triggerSchema = z.object({
  workflow_version_id: z.string().uuid(),
  type: z.enum(['calendar', 'webhook', 'data', 'user_event']),
  config: z.record(z.string(), z.any()),
  is_active: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
})

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

    const supabase = getServiceClient()
    const { searchParams } = new URL(request.url)
    const workflowVersionId = searchParams.get('workflow_version_id')

    let query = supabase
      .from('lab_workflow_triggers')
      .select('*')
      .order('created_at', { ascending: false })

    if (workflowVersionId) {
      query = query.eq('workflow_version_id', workflowVersionId)
    }

    const { data: triggers, error } = await query

    if (error) {
      console.error('[WorkflowTriggers][GET] erro:', error)
      return NextResponse.json({ error: 'Erro ao listar triggers' }, { status: 400 })
    }

    return NextResponse.json({ triggers: triggers || [] })
  } catch (error: any) {
    console.error('[WorkflowTriggers][GET] falha inesperada:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = triggerSchema.parse(body)

    const supabase = getServiceClient()
    const insertData = {
      ...parsed,
      owner_user_id: user.id,
    }

    const { data, error } = await supabase
      .from('lab_workflow_triggers')
      .insert(insertData)
      .select('*')
      .single()

    if (error) {
      console.error('[WorkflowTriggers][POST] erro:', error)
      return NextResponse.json({ error: error.message || 'Erro ao criar trigger' }, { status: 400 })
    }

    return NextResponse.json({ trigger: data })
  } catch (error: any) {
    console.error('[WorkflowTriggers][POST] falha inesperada:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}


