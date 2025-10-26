import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { listMemories, clearAllMemories } from '@/modules/laboratorio-ia/services/memory'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    // Listar memórias
    const memories = await listMemories({
      userId: user.id,
      agentId: agentId || null,
    })

    return NextResponse.json({ memories })
  } catch (error) {
    console.error('Error fetching memories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    // Limpar memórias
    await clearAllMemories({
      userId: user.id,
      agentId: agentId || null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing memories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
