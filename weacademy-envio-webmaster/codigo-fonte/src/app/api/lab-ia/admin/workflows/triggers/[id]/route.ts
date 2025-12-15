import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

const triggerUpdateSchema = z.object({
  type: z.enum(['calendar', 'webhook', 'data', 'user_event']).optional(),
  config: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = triggerUpdateSchema.parse(body)

    const supabase = getServiceClient()

    const { data: existing } = await supabase
      .from('lab_workflow_triggers')
      .select('id, owner_user_id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Trigger não encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('lab_workflow_triggers')
      .update({
        ...parsed,
        owner_user_id: existing.owner_user_id ?? user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      console.error('[WorkflowTriggers][PUT] erro:', error)
      return NextResponse.json({ error: error.message || 'Erro ao atualizar trigger' }, { status: 400 })
    }

    return NextResponse.json({ trigger: data })
  } catch (error: any) {
    console.error('[WorkflowTriggers][PUT] falha inesperada:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = getServiceClient()

    const { data: existing } = await supabase
      .from('lab_workflow_triggers')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Trigger não encontrado' }, { status: 404 })
    }

    const { error } = await supabase
      .from('lab_workflow_triggers')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('[WorkflowTriggers][DELETE] erro:', error)
      return NextResponse.json({ error: error.message || 'Erro ao remover trigger' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[WorkflowTriggers][DELETE] falha inesperada:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}


