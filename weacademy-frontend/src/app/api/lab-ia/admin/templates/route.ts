import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { agentSchema } from '@/lib/validations/agent.schema'
import { z } from 'zod'

const templateSchema = agentSchema

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const category = searchParams.get('category')
    const provider = searchParams.get('provider')
    const type = searchParams.get('type')
    const offset = (page - 1) * limit

    // Construir query
    let query = supabase
      .from('lab_agent_templates')
      .select('*', { count: 'exact' })

    if (category) {
      query = query.eq('category', category)
    }
    if (provider) {
      query = query.eq('provider', provider)
    }
    if (type) {
      query = query.eq('type', type)
    }

    const { data: templates, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return NextResponse.json({
      templates,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Validar dados
    const body = await request.json()
    const validatedData = templateSchema.parse(body)

    // Criar template
    const { data: template, error } = await supabase
      .from('lab_agent_templates')
      .insert(validatedData)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Rota para exportar templates em JSON
export async function OPTIONS(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'export') {
      const supabase = await createClient()
      const { data: templates, error } = await supabase
        .from('lab_agent_templates')
        .select('*')
        .order('name')

      if (error) throw error

      return NextResponse.json({
        templates,
        exported_at: new Date().toISOString(),
        version: '1.0',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error exporting templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
