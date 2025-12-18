import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'

/**
 * GET /api/lab-ia/admin/test-reports/[filename]
 * Serve um relatório específico (JSON ou TXT)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ filename: string }> }
) {
  try {
    // Next.js 15+ pode usar params como Promise
    const params = await props.params
    const filenameParam = params?.filename || ''

    console.log('[Admin][Test Reports] Params recebidos:', params)
    console.log('[Admin][Test Reports] Filename param:', filenameParam)

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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Validar nome do arquivo (prevenir path traversal)
    // Next.js já decodifica os parâmetros de rota automaticamente
    let filename = filenameParam

    console.log('[Admin][Test Reports] Filename recebido (raw):', filename)
    console.log('[Admin][Test Reports] Tipo:', typeof filename)

    // Next.js 13+ decodifica automaticamente, mas vamos garantir
    // Se vier codificado (com %), tentar decodificar
    if (filename.includes('%')) {
      try {
        const decoded = decodeURIComponent(filename)
        console.log('[Admin][Test Reports] Filename decodificado:', decoded)
        filename = decoded
      } catch (e) {
        console.log('[Admin][Test Reports] Erro ao decodificar:', e)
        // Continuar com o original se falhar
      }
    }

    console.log('[Admin][Test Reports] Filename final para validação:', filename)
    console.log('[Admin][Test Reports] Length:', filename.length)
    console.log('[Admin][Test Reports] Starts with llm-models-test-:', filename.startsWith('llm-models-test-'))
    console.log('[Admin][Test Reports] Ends with .json:', filename.endsWith('.json'))
    console.log('[Admin][Test Reports] Ends with .txt:', filename.endsWith('.txt'))

    // Validar nome do arquivo (prevenir path traversal)
    // Verificar apenas caracteres perigosos, não restringir demais
    if (!filename || filename.trim() === '') {
      console.error('[Admin][Test Reports] Filename vazio')
      return NextResponse.json(
        { error: 'Nome de arquivo inválido: arquivo não especificado' },
        { status: 400 }
      )
    }

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.error('[Admin][Test Reports] Filename contém caracteres perigosos:', filename)
      return NextResponse.json(
        { error: 'Nome de arquivo inválido: contém caracteres perigosos' },
        { status: 400 }
      )
    }

    if (filename.length > 255) {
      console.error('[Admin][Test Reports] Filename muito longo:', filename.length)
      return NextResponse.json(
        { error: 'Nome de arquivo inválido: muito longo' },
        { status: 400 }
      )
    }

    // Verificar se é um arquivo de relatório válido (começa com prefixo esperado)
    const isValidReport = filename.startsWith('llm-models-test-') &&
      (filename.endsWith('.json') || filename.endsWith('.txt'))

    if (!isValidReport) {
      console.error('[Admin][Test Reports] Arquivo não é um relatório válido:', {
        filename,
        startsWith: filename.startsWith('llm-models-test-'),
        endsWithJson: filename.endsWith('.json'),
        endsWithTxt: filename.endsWith('.txt'),
        firstChars: filename.substring(0, 20),
        lastChars: filename.substring(filename.length - 10),
      })
      return NextResponse.json(
        { error: `Arquivo não é um relatório válido. Recebido: "${filename}"` },
        { status: 400 }
      )
    }

    // Buscar arquivo no diretório test-reports
    const reportsDir = path.join(process.cwd(), 'test-reports')
    const filePath = path.join(reportsDir, filename)

    // Verificar se o arquivo existe e está dentro do diretório permitido
    if (!fs.existsSync(filePath) || !filePath.startsWith(reportsDir)) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    // Ler e retornar o arquivo
    const content = fs.readFileSync(filePath, 'utf-8')

    // Determinar content-type baseado na extensão
    const isJson = filename.endsWith('.json')
    const isText = filename.endsWith('.txt')

    if (isJson) {
      try {
        const jsonContent = JSON.parse(content)
        return NextResponse.json(jsonContent, {
          headers: {
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      } catch (error) {
        return NextResponse.json(
          { error: 'Erro ao parsear JSON' },
          { status: 500 }
        )
      }
    } else if (isText) {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[Admin][Test Reports] Erro ao servir arquivo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao servir relatório' },
      { status: 500 }
    )
  }
}

