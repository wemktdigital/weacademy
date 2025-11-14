import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { listHumanTasks } from '@/modules/laboratorio-ia/services/humanTaskService'

const listSchema = z.object({
  status: z.string().optional(),
  workflow_instance_id: z.string().uuid().optional(),
  workflow_version_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  assignee_user_id: z.string().uuid().optional(),
  include_completed: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? parseInt(value, 10) : undefined)),
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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsedParams = listSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      workflow_instance_id: searchParams.get('workflow_instance_id') ?? undefined,
      workflow_version_id: searchParams.get('workflow_version_id') ?? undefined,
      stage_id: searchParams.get('stage_id') ?? undefined,
      assignee_user_id: searchParams.get('assignee_user_id') ?? undefined,
      include_completed: searchParams.get('include_completed') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsedParams.success) {
      return NextResponse.json(
        { error: parsedParams.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const tasks = await listHumanTasks({
      status: parsedParams.data.status,
      workflowInstanceId: parsedParams.data.workflow_instance_id,
      workflowVersionId: parsedParams.data.workflow_version_id,
      stageId: parsedParams.data.stage_id,
      assigneeUserId: parsedParams.data.assignee_user_id,
      includeCompleted: parsedParams.data.include_completed,
      limit: parsedParams.data.limit,
    })

    return NextResponse.json({ tasks })
  } catch (error: any) {
    console.error('[WorkflowHumanTasks][GET] erro inesperado:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao listar tarefas humanas' },
      { status: 500 }
    )
  }
}

