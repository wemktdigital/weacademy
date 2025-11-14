import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { messageId, isFavorite } = await request.json()

    if (!messageId || typeof isFavorite !== 'boolean') {
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

    // Verificar se a mensagem pertence ao usuário através da conversa
    const { data: message, error: messageError } = await supabase
      .from('lab_messages')
      .select(`
        id,
        conversation_id,
        lab_conversations!inner(user_id)
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message || (message.lab_conversations as any)?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Mensagem não encontrada ou sem permissão' },
        { status: 403 }
      )
    }

    // Atualizar favorito da mensagem
    const { error } = await supabase
      .from('lab_messages')
      .update({ is_favorite: isFavorite })
      .eq('id', messageId)

    if (error) {
      console.error('Erro ao atualizar favorito:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar mensagem' },
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
