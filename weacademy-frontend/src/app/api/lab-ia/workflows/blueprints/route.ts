import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 50)

    const { data, error: listError } = await supabase
      .from('lab_workflow_blueprints')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (listError) throw listError

    return NextResponse.json({ success: true, blueprints: data || [] })
  } catch (err: any) {
    console.error('[Workflows][Blueprint][GET] Erro ao listar blueprints:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao listar blueprints' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, tags = [], canvas = {}, settings = {} } = body

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const { data, error: insertError } = await supabase
      .from('lab_workflow_blueprints')
      .insert({
        owner_user_id: user.id,
        name,
        description,
        category,
        tags,
        canvas,
        settings,
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, blueprint: data })
  } catch (err: any) {
    console.error('[Workflows][Blueprint][POST] Erro ao criar blueprint:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao criar blueprint' }, { status: 500 })
  }
}

