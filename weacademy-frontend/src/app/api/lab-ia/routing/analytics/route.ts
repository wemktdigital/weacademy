import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getRoutingAnalytics } from '@/modules/laboratorio-ia/services/routingOptimizer'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const analytics = await getRoutingAnalytics(user.id)

    return NextResponse.json({ success: true, analytics })
  } catch (err: any) {
    console.error('[Routing][Analytics] Erro ao gerar dashboard:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar analytics de routing' },
      { status: 500 }
    )
  }
}
