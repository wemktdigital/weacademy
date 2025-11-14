import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { pipelineSchema } from '@/lib/validations/pipeline.schema'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Tentar autenticar via Authorization: Bearer <token>
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user: any = null
    let authError: any = null

    console.log('[API][pipelines][id] PUT - Token no header:', !!token)

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      if (!error && data?.user) {
        user = data.user
        console.log('[API][pipelines][id] PUT - Usuário autenticado via token:', user.id)
      } else {
        authError = error
        console.log('[API][pipelines][id] PUT - Erro ao autenticar via token:', error?.message)
      }
    }

    // Fallback: autenticar via cookies (sessão do usuário)
    if (!user) {
      try {
        const supabase = await supabaseServer()
        const { data, error } = await supabase.auth.getUser()
        if (!error && data?.user) {
          user = data.user
          console.log('[API][pipelines][id] PUT - Usuário autenticado via cookies:', user.id)
        } else {
          authError = error
          console.log('[API][pipelines][id] PUT - Erro ao autenticar via cookies:', error?.message)
        }
      } catch (err) {
        console.error('[API][pipelines][id] PUT - Erro ao usar supabaseServer:', err)
      }
    }

    if (!user) {
      console.error('[API][pipelines][id] PUT - Usuário não autenticado', {
        hasToken: !!token,
        authError: authError?.message,
        authErrorCode: authError?.code,
      })
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'Token inválido ou ausente', code: authError?.code },
        { status: 401 }
      )
    }

    // Verificar se é admin
    const serviceRoleForProfile = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await serviceRoleForProfile
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'gestor_we', 'gestor'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Validar dados
    const body = await request.json()
    const validatedData = pipelineSchema.parse(body)

    // Atualizar com service role (após validar role)
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: pipeline, error } = await serviceRoleSupabase
      .from('lab_agent_pipelines')
      .update(validatedData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(pipeline)
  } catch (error) {
    console.error('Error updating pipeline:', error)
    
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Tentar Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user: any = null
    let authError: any = null
    
    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      user = data?.user || null
      authError = error
    }

    if (!user) {
      const supabase = await supabaseServer()
      const { data, error } = await supabase.auth.getUser()
      user = data?.user || null
      authError = error
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    const serviceRoleForProfile = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await serviceRoleForProfile
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'gestor_we', 'gestor'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Excluir com service role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await serviceRoleSupabase
      .from('lab_agent_pipelines')
      .delete()
      .eq('id', params.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pipeline:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
