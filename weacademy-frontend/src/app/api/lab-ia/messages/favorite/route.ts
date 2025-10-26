import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { messageId, isFavorite } = await request.json()

    if (!messageId || typeof isFavorite !== 'boolean') {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      )
    }

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
