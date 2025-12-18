import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  getHumanTask,
  updateHumanTask,
  logHumanTaskAction,
  getServiceClient,
} from '@/modules/laboratorio-ia/services/humanTaskService'

const patchSchema = z.object({
  status: z.string().optional(),
  assignee_user_id: z.string().uuid().optional().nullable(),
  assignee_role: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
  decision: z.string().optional().nullable(),
  decision_reason: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
})

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await supabaseServer()
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (token) {
    const {
      data: { user: tokenUser },
      error: tokenError,
    } = await supabase.auth.getUser(token)
    if (!tokenError && tokenUser) {
      return tokenUser
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user || null
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const task = await getHumanTask(params.id)

    const serviceSupabase = getServiceClient()
    const { data: logs } = await serviceSupabase
      .from('lab_workflow_human_task_logs')
      .select('*')
      .eq('human_task_id', params.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ task, logs: logs || [] })
  } catch (error: any) {
    console.error('[WorkflowHumanTasks][GET:id] erro:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar tarefa humana' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const updates = parsed.data
    const updatedTask = await updateHumanTask(params.id, {
      status: updates.status,
      assignee_user_id:
        updates.assignee_user_id === undefined ? undefined : updates.assignee_user_id,
      assignee_role:
        updates.assignee_role === undefined ? undefined : updates.assignee_role,
      due_at: updates.due_at === undefined ? undefined : updates.due_at,
      decision: updates.decision === undefined ? undefined : updates.decision,
      decision_reason:
        updates.decision_reason === undefined ? undefined : updates.decision_reason,
      metadata: updates.metadata ?? undefined,
    })

    await logHumanTaskAction(params.id, 'manual_update', user.id, updates)

    return NextResponse.json({ task: updatedTask })
  } catch (error: any) {
    console.error('[WorkflowHumanTasks][PATCH:id] erro:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao atualizar tarefa humana' },
      { status: 500 }
    )
  }
}

