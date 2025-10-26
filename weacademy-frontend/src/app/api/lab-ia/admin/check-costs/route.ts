import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: Request) {
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

    // Verificar se é admin ou gestor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'gestor_we'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Obter limite de custo do ambiente
    const maxCost = parseFloat(process.env.LAB_MAX_COST_USD || '50')
    const alertEmail = process.env.LAB_ALERT_EMAIL || 'contato@wemarketingdigital.com.br'

    // Buscar todos os usuários e calcular custo total
    const { data: allUsers } = await supabase.auth.admin.listUsers()

    const costAlerts: Array<{
      userId: string
      email: string
      totalCost: number
      alertSent: boolean
    }> = []

    for (const userItem of allUsers.users || []) {
      // Calcular custo total para este usuário
      const { data: costData } = await supabase
        .from('lab_agent_logs')
        .select('cost_usd')
        .eq('user_id', userItem.id)

      let totalCost = 0
      costData?.forEach((row) => {
        totalCost += parseFloat(row.cost_usd?.toString() || '0')
      })

      if (totalCost > maxCost) {
        // Verificar se já existe alerta recente (últimas 24h)
        const { data: existingAlert } = await supabase
          .from('lab_cost_alerts')
          .select('id')
          .eq('user_id', userItem.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!existingAlert) {
          // Criar alerta
          await supabase
            .from('lab_cost_alerts')
            .insert({
              user_id: userItem.id,
              total_cost: totalCost,
              alert_sent: false,
            })

          costAlerts.push({
            userId: userItem.id,
            email: userItem.email || '',
            totalCost: parseFloat(totalCost.toFixed(4)),
            alertSent: false,
          })

          // TODO: Enviar email via Resend
          console.log(`ALERT: User ${userItem.email} exceeded cost limit: $${totalCost.toFixed(4)}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      alertsGenerated: costAlerts.length,
      alerts: costAlerts,
    })
  } catch (error) {
    console.error('Error checking costs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
