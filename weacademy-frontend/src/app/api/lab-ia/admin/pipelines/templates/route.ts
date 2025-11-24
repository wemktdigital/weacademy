import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer()
    
    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    // Buscar templates
    let query = supabase
      .from('lab_pipeline_templates')
      .select('*')
      .order('official', { ascending: false })
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: templates, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      templates: templates || [],
    })
  } catch (error) {
    console.error('Error fetching pipeline templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Tentar autenticar via Authorization: Bearer <token>
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user: any = null

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      if (!error && data?.user) {
        user = data.user
      }
    }

    // Fallback para verificação de sessão
    if (!user) {
      try {
        const supabase = await supabaseServer()
        const { data, error } = await supabase.auth.getUser()
        if (!error && data?.user) {
          user = data.user
        }
      } catch (err) {
        console.error('[API][pipelines/templates] POST - Erro ao usar supabaseServer:', err)
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Token inválido ou ausente' },
        { status: 401 }
      )
    }

    // Verificar role com service role (bypass RLS)
    const serviceRoleForProfile = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await serviceRoleForProfile
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Permitir apenas admin
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Validar dados
    const body = await request.json()
    const { name, description, category, steps, agent_templates, official } = body

    if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'name e steps são obrigatórios' },
        { status: 400 }
      )
    }

    // Criar template usando service role (bypass RLS após validar a role)
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: template, error } = await serviceRoleSupabase
      .from('lab_pipeline_templates')
      .insert({
        name,
        description,
        category: category || null,
        steps,
        agent_templates: agent_templates || null,
        official: official || false,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    console.error('Error creating pipeline template:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

