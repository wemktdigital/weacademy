import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { conversationId, isFavorite } = await request.json()

    if (!conversationId || typeof isFavorite !== 'boolean') {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      )
    }

    // Verificar autenticação via header Authorization
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Criar cliente Supabase com o token
    const supabase = createClient(
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

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Atualizar favorito da conversa
    const { error } = await supabase
      .from('lab_conversations')
      .update({ is_favorite: isFavorite })
      .eq('id', conversationId)
      .eq('user_id', user.id) // Garantir que só atualiza suas próprias conversas

    if (error) {
      console.error('Erro ao atualizar favorito:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar conversa' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro na API de favorito:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}

