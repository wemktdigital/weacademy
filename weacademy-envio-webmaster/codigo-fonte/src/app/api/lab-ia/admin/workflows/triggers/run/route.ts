import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { runCalendarTriggers } from '@/modules/laboratorio-ia/services/workflowScheduler'

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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'

    const nowParam = searchParams.get('at')
    const date = nowParam ? new Date(nowParam) : new Date()
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Parâmetro "at" inválido' }, { status: 400 })
    }

    if (dryRun) {
      const results = await runCalendarTriggers(date)
      return NextResponse.json({ success: true, results, dryRun: true })
    }

    const results = await runCalendarTriggers(date)
    return NextResponse.json({ success: true, results, dryRun: false })
  } catch (error: any) {
    console.error('[WorkflowTriggers][Run] erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao executar triggers' }, { status: 500 })
  }
}


