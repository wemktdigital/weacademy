import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import ExcelJS from 'exceljs'

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
        { error: 'Unauthorized' },
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
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Buscar dados de agentes executados usando service role
    const { data: agentLogs, error: agentError } = await serviceRoleSupabase
      .from('lab_agent_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (agentError) {
      throw agentError
    }

    // Buscar emails dos usuários separadamente
    const userIds = [...new Set(agentLogs?.map(log => log.user_id).filter(Boolean) || [])]
    const userEmailsMap = new Map<string, string>()

    if (userIds.length > 0) {
      // Buscar emails usando auth.admin.listUsers() e filtrar pelos IDs
      const { data: allUsers } = await serviceRoleSupabase.auth.admin.listUsers()
      allUsers.users?.forEach(user => {
        if (userIds.includes(user.id)) {
          userEmailsMap.set(user.id, user.email || 'N/A')
        }
      })
    }

    // Buscar dados de mensagens usando service role
    const { data: messages, error: messagesError } = await serviceRoleSupabase
      .from('lab_messages')
      .select(`
        id,
        conversation_id,
        role,
        content,
        created_at,
        conversations:conversation_id (
          user_id,
          provider,
          model
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000) // Limitar para não gerar arquivo muito grande

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
    }

    // Criar workbook do Excel
    const workbook = new ExcelJS.Workbook()

    // Aba: Agentes Executados
    const agentSheet = workbook.addWorksheet('Agentes Executados')
    agentSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Usuário', key: 'email', width: 30 },
      { header: 'Agente', key: 'agent_id', width: 30 },
      { header: 'Provedor', key: 'provider', width: 15 },
      { header: 'Modelo', key: 'model', width: 20 },
      { header: 'Latência (ms)', key: 'latency_ms', width: 15 },
      { header: 'Custo (USD)', key: 'cost_usd', width: 15 },
      { header: 'Data', key: 'created_at', width: 20 },
    ]

    agentLogs?.forEach((log: any) => {
      agentSheet.addRow({
        id: log.id,
        email: userEmailsMap.get(log.user_id) || 'N/A',
        agent_id: log.agent_id || 'N/A',
        provider: log.provider || 'N/A',
        model: log.model || 'N/A',
        latency_ms: log.latency_ms || 0,
        cost_usd: parseFloat(log.cost_usd?.toString() || '0').toFixed(4),
        created_at: new Date(log.created_at).toLocaleString('pt-BR'),
      })
    })

    // Aba: Mensagens
    if (messages && messages.length > 0) {
      const messagesSheet = workbook.addWorksheet('Mensagens')
      messagesSheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'Conversa ID', key: 'conversation_id', width: 15 },
        { header: 'Papel', key: 'role', width: 10 },
        { header: 'Conteúdo', key: 'content', width: 50 },
        { header: 'Provedor', key: 'provider', width: 15 },
        { header: 'Modelo', key: 'model', width: 20 },
        { header: 'Data', key: 'created_at', width: 20 },
      ]

      messages.forEach((message: any) => {
        const conv = message.conversations as any
        messagesSheet.addRow({
          id: message.id,
          conversation_id: message.conversation_id,
          role: message.role,
          content: (message.content || '').substring(0, 500), // Limitar tamanho
          provider: conv?.provider || 'N/A',
          model: conv?.model || 'N/A',
          created_at: new Date(message.created_at).toLocaleString('pt-BR'),
        })
      })
    }

    // Estilizar cabeçalhos
    [agentSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true }
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF29CEDF' },
      }
    })

    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Retornar como download
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=lab-ia-relatorio-${new Date().toISOString().split('T')[0]}.xlsx`,
      },
    })
  } catch (error) {
    console.error('Error exporting report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
