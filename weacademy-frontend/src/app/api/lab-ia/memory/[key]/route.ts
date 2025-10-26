import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { forget } from '@/modules/laboratorio-ia/services/memory'

export async function DELETE(
  request: Request,
  { params }: { params: { key: string } }
) {
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

    // Deletar memória
    await forget({
      userId: user.id,
      agentId: agentId || null,
      key: decodeURIComponent(params.key),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting memory:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
