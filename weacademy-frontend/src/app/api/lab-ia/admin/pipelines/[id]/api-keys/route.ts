import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { apiKeySchema } from '@/lib/validations/apiKey.schema'
import { createClient } from '@supabase/supabase-js'
import { generateApiKey, hashApiKey } from '@/modules/laboratorio-ia/services/apiKeyManager'

/**
 * GET /api/lab-ia/admin/pipelines/[id]/api-keys
 * Lista API keys de um pipeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params

    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Buscar API keys (apenas do próprio usuário ou admin)
    let query = serviceSupabase
      .from('lab_pipeline_api_keys')
      .select('*')
      .eq('pipeline_id', pipelineId)

    if (!profile || !['admin', 'gestor_we', 'gestor'].includes(profile.role)) {
      query = query.eq('user_id', user.id)
    }

    const { data: apiKeys, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('[API Keys] Erro ao buscar keys:', error)
      throw error
    }

    // Não retornar api_key completa (apenas prefixo + ...)
    const sanitizedKeys = (apiKeys || []).map(key => ({
      ...key,
      api_key: key.api_key ? `${key.api_key.substring(0, 8)}...` : undefined, // Mostrar apenas prefixo
    }))

    return NextResponse.json({
      api_keys: sanitizedKeys,
    })
  } catch (error: any) {
    console.error('[API Keys] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/admin/pipelines/[id]/api-keys
 * Cria nova API key para um pipeline
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params

    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validar e parsear body
    const body = await request.json()
    const validatedData = apiKeySchema.parse(body)

    // Verificar se pipeline existe e usuário tem acesso
    const { data: pipeline } = await serviceSupabase
      .from('lab_agent_pipelines')
      .select('id, user_id')
      .eq('id', pipelineId)
      .single()

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile && ['admin', 'gestor_we', 'gestor'].includes(profile.role)
    if (pipeline.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Gerar nova API key
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)

    // Criar API key no banco
    const { data: newApiKey, error: insertError } = await serviceSupabase
      .from('lab_pipeline_api_keys')
      .insert({
        user_id: user.id,
        pipeline_id: pipelineId,
        name: validatedData.name,
        key_hash: keyHash,
        api_key: apiKey, // Armazenar apenas uma vez (depois será ocultado)
        prefix: 'wak_',
        rate_limit_per_minute: validatedData.rate_limit_per_minute,
        rate_limit_per_hour: validatedData.rate_limit_per_hour,
        rate_limit_per_day: validatedData.rate_limit_per_day,
        expires_at: validatedData.expires_at || null,
        enabled: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[API Keys] Erro ao criar key:', insertError)
      throw insertError
    }

    // Retornar API key completa apenas na criação
    return NextResponse.json({
      success: true,
      api_key: {
        ...newApiKey,
        api_key, // Retornar API key completa apenas na criação
      },
      message: 'API key created successfully. Save this key - it will not be shown again.',
    }, { status: 201 })
  } catch (error: any) {
    console.error('[API Keys] Erro ao criar key:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
