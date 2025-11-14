import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'

interface TestResult {
  provider: string
  model: string
  displayName: string
  status: 'success' | 'error'
  latency?: number
  error?: string
  responsePreview?: string
  timestamp: string
}

/**
 * POST /api/lab-ia/admin/test-reports/test-single
 * Testa um modelo LLM individual
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação via header Authorization
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let user = null

    // Tentar autenticar via token primeiro
    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )

      const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    // Fallback para cookies se não autenticou via token
    if (!user) {
      const cookieStore = await cookies()
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            storage: {
              getItem: async (key: string) => cookieStore.get(key)?.value || null,
              setItem: async (key: string, value: string) => {
                // Não implementado - cookies são gerenciados pelo servidor
              },
              removeItem: async (key: string) => {
                // Não implementado - cookies são gerenciados pelo servidor
              },
            },
          },
        }
      )
      
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (!authError && cookieUser) {
        user = cookieUser
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é admin ou gestor usando service role para bypass RLS
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'gestor_we'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem executar testes.' },
        { status: 403 }
      )
    }

    // Obter parâmetros do body
    const { provider, model, testMessage } = await request.json()

    if (!provider || !model) {
      return NextResponse.json(
        { error: 'Provider e model são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se o modelo existe
    const modelConfig = AVAILABLE_MODELS.find(
      m => m.provider === provider && m.model === model
    )

    if (!modelConfig) {
      return NextResponse.json(
        { error: `Modelo ${provider}:${model} não encontrado` },
        { status: 404 }
      )
    }

    // Verificar se é modelo de texto (pular vídeo por padrão)
    if (!modelConfig.capabilities?.output?.includes('text')) {
      return NextResponse.json(
        { error: 'Testes individuais disponíveis apenas para modelos de texto' },
        { status: 400 }
      )
    }

    // Obter token para usar nas chamadas de API
    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação não fornecido' },
        { status: 401 }
      )
    }

    const authToken = token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const startTime = Date.now()

    try {
      const response = await fetch(`${baseUrl}/api/lab-ia/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: testMessage || 'Responda apenas com "OK" se você está funcionando corretamente.',
            },
          ],
          provider: modelConfig.provider,
          model: modelConfig.model,
          stream: false,
        }),
      })

      const latency = Date.now() - startTime

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        let errorData: any = { error: `HTTP ${response.status} ${response.statusText}` }
        
        if (contentType.includes('application/json')) {
          try {
            errorData = await response.json()
          } catch {
            const text = await response.text()
            errorData = { error: text || `HTTP ${response.status}` }
          }
        } else {
          const text = await response.text()
          errorData = { error: text || `HTTP ${response.status}` }
        }

        const result: TestResult = {
          provider: modelConfig.provider,
          model: modelConfig.model,
          displayName: modelConfig.displayName,
          status: 'error',
          error: errorData.error || `HTTP ${response.status}`,
          latency,
          timestamp: new Date().toISOString(),
        }

        return NextResponse.json(result)
      }

      const contentType = response.headers.get('content-type') || ''
      let data: any = {}
      
      // Tentar parsear como JSON primeiro
      if (contentType.includes('application/json')) {
        try {
          data = await response.json()
        } catch (parseError) {
          // Se falhar, tentar como texto
          const text = await response.text()
          data = { content: text }
        }
      } else {
        // Se não for JSON, ler como texto
        const text = await response.text()
        data = { content: text }
      }

      const result: TestResult = {
        provider: modelConfig.provider,
        model: modelConfig.model,
        displayName: modelConfig.displayName,
        status: 'success',
        latency,
        responsePreview: data.content?.substring(0, 100) || 'Sem conteúdo',
        timestamp: new Date().toISOString(),
      }

      return NextResponse.json(result)
    } catch (error: any) {
      const result: TestResult = {
        provider: modelConfig.provider,
        model: modelConfig.model,
        displayName: modelConfig.displayName,
        status: 'error',
        error: error.message || 'Erro desconhecido',
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      return NextResponse.json(result, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Admin][Test Reports][Test Single] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao executar teste' },
      { status: 500 }
    )
  }
}

