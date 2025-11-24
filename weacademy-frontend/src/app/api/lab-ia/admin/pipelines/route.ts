import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { pipelineSchema } from '@/lib/validations/pipeline.schema'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer()
    
    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Buscar pipelines
    const { data: pipelines, error, count } = await supabase
      .from('lab_agent_pipelines')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return NextResponse.json({
      pipelines,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching pipelines:', error)
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
    let authError: any = null

    console.log('[API][pipelines] POST - Token no header:', !!token)

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      if (!error && data?.user) {
        user = data.user
        console.log('[API][pipelines] POST - Usuário autenticado via token:', user.id)
      } else {
        authError = error
        console.log('[API][pipelines] POST - Erro ao autenticar via token:', error?.message)
      }
    }

    // Fallback: autenticar via cookies (sessão do usuário)
    if (!user) {
      try {
        const supabase = await supabaseServer()
        const { data, error } = await supabase.auth.getUser()
        if (!error && data?.user) {
          user = data.user
          console.log('[API][pipelines] POST - Usuário autenticado via cookies:', user.id)
        } else {
          authError = error
          console.log('[API][pipelines] POST - Erro ao autenticar via cookies:', error?.message)
        }
      } catch (err) {
        console.error('[API][pipelines] POST - Erro ao usar supabaseServer:', err)
      }
    }

    if (!user) {
      console.error('[API][pipelines] POST - Usuário não autenticado', { 
        hasToken: !!token,
        authError: authError?.message,
        authErrorCode: authError?.code,
      })
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'Token inválido ou ausente', code: authError?.code },
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
    const validatedData = pipelineSchema.parse(body)

    // Criar pipeline usando service role (bypass RLS após validar a role)
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: pipeline, error } = await serviceRoleSupabase
      .from('lab_agent_pipelines')
      .insert(validatedData)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(pipeline, { status: 201 })
  } catch (error) {
    console.error('Error creating pipeline:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
