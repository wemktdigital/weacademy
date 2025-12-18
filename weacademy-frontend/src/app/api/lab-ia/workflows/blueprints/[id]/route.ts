import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

interface Params {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, props: Params) {
  try {
    const params = await props.params
    const { id } = params
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error: fetchError } = await supabase
      .from('lab_workflow_blueprints')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single()

    if (fetchError || !data) {
      return NextResponse.json({ error: 'Blueprint não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, blueprint: data })
  } catch (err: any) {
    console.error('[Workflows][Blueprint][GET] Erro ao carregar blueprint:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao carregar blueprint' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, props: Params) {
  try {
    const params = await props.params
    const { id } = params
    const body = await request.json()

    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const updatePayload: Record<string, any> = {}
      ;['name', 'description', 'category', 'tags', 'canvas', 'settings', 'published_workflow_version_id'].forEach((key) => {
        if (key in body) updatePayload[key] = body[key]
      })

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const { data, error: updateError } = await supabase
      .from('lab_workflow_blueprints')
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .select('*')
      .single()

    if (updateError || !data) {
      return NextResponse.json({ error: 'Blueprint não encontrado ou erro ao atualizar' }, { status: 404 })
    }

    return NextResponse.json({ success: true, blueprint: data })
  } catch (err: any) {
    console.error('[Workflows][Blueprint][PUT] Erro ao atualizar blueprint:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar blueprint' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: Params) {
  try {
    const params = await props.params
    const { id } = params
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('lab_workflow_blueprints')
      .delete()
      .eq('id', id)
      .eq('owner_user_id', user.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Workflows][Blueprint][DELETE] Erro ao excluir blueprint:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao excluir blueprint' }, { status: 500 })
  }
}

