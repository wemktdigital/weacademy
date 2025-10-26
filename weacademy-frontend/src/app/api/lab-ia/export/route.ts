import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { conversationId } = await request.json()

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar conversa
    const { data: conversation, error: convError } = await supabase
      .from('lab_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // Buscar mensagens
    const { data: messages, error: msgError } = await supabase
      .from('lab_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) {
      return NextResponse.json(
        { error: 'Erro ao buscar mensagens' },
        { status: 500 }
      )
    }

    // Gerar Markdown
    let markdown = `# ${conversation.title}\n\n`
    markdown += `**Modelo:** ${conversation.provider} - ${conversation.model}\n`
    markdown += `**Criado em:** ${new Date(conversation.created_at).toLocaleString('pt-BR')}\n`
    markdown += `**Atualizado em:** ${new Date(conversation.updated_at).toLocaleString('pt-BR')}\n\n`
    markdown += `---\n\n`

    messages?.forEach((msg) => {
      const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const role = msg.role === 'user' ? '**Você**' : '**Assistente**'
      markdown += `## ${role} - ${time}\n\n`
      markdown += `${msg.content}\n\n`
      if (msg.is_favorite) {
        markdown += `⭐ *Mensagem favorita*\n\n`
      }
      markdown += `---\n\n`
    })

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${conversation.title}.md"`,
      },
    })
  } catch (error: any) {
    console.error('Erro na API de exportação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao exportar conversa' },
      { status: 500 }
    )
  }
}
