import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'

/**
 * GET /api/lab-ia/admin/test-reports
 * Lista todos os relatórios de teste disponíveis
 */
export async function GET(request: NextRequest) {
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
        { error: 'Acesso negado. Apenas administradores podem acessar relatórios de teste.' },
        { status: 403 }
      )
    }

    // Buscar relatórios no diretório test-reports
    const reportsDir = path.join(process.cwd(), 'test-reports')
    
    if (!fs.existsSync(reportsDir)) {
      return NextResponse.json({
        reports: [],
        message: 'Diretório de relatórios não encontrado. Execute os testes primeiro.',
      })
    }

    const files = fs.readdirSync(reportsDir)
    
    // Filtrar apenas arquivos JSON de relatórios
    const reportFiles = files
      .filter(file => file.startsWith('llm-models-test-') && file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(reportsDir, file)
        const stats = fs.statSync(filePath)
        
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const report = JSON.parse(content)
          
          return {
            filename: file,
            timestamp: report.timestamp || stats.mtime.toISOString(),
            summary: report.summary || null,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
          }
        } catch (error) {
          // Se não conseguir parsear, retornar apenas metadados básicos
          return {
            filename: file,
            timestamp: stats.mtime.toISOString(),
            summary: null,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            error: 'Erro ao ler relatório',
          }
        }
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) // Mais recentes primeiro

    return NextResponse.json({
      reports: reportFiles,
      total: reportFiles.length,
    })
  } catch (error: any) {
    console.error('[Admin][Test Reports] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao listar relatórios' },
      { status: 500 }
    )
  }
}

