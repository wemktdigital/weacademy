import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/lab-ia/agents - Listar agentes ativos (público)
export async function GET(request: NextRequest) {
  try {
    // Usar service role para bypass RLS e buscar apenas agentes ativos
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar apenas agentes ativos (endpoint público)
    const { data: agents, error } = await serviceRoleSupabase
      .from('lab_agents')
      .select('id, name, description, icon, type, provider, model, category, active, usage_instructions, expected_result')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API][lab-ia/agents] Erro ao buscar agentes:', error)
      throw error
    }

    console.log('[API][lab-ia/agents] Agentes encontrados:', agents?.length || 0)

    return NextResponse.json({
      agents: agents || [],
    })
  } catch (error: any) {
    console.error('Error fetching active agents:', error)
    return NextResponse.json(
      { error: 'Internal server error', agents: [] },
      { status: 500 }
    )
  }
}

