import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
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

    // Obter limite de custo do ambiente
    const maxCost = parseFloat(process.env.LAB_MAX_COST_USD || '50')
    const alertEmail = process.env.LAB_ALERT_EMAIL || 'contato@wemarketingdigital.com.br'

    // Buscar todos os usuários e calcular custo total
    const { data: allUsers } = await serviceRoleSupabase.auth.admin.listUsers()

    const costAlerts: Array<{
      userId: string
      email: string
      totalCost: number
      alertSent: boolean
    }> = []

    for (const userItem of allUsers.users || []) {
      // Calcular custo total para este usuário
      const { data: costData } = await serviceRoleSupabase
        .from('lab_agent_logs')
        .select('cost_usd')
        .eq('user_id', userItem.id)

      let totalCost = 0
      costData?.forEach((row) => {
        totalCost += parseFloat(row.cost_usd?.toString() || '0')
      })

      if (totalCost > maxCost) {
        // Verificar se já existe alerta recente (últimas 24h)
        const { data: existingAlert } = await serviceRoleSupabase
          .from('lab_cost_alerts')
          .select('id')
          .eq('user_id', userItem.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!existingAlert) {
          // Criar alerta
          await serviceRoleSupabase
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

          // Enviar email via Resend
          try {
            await resend.emails.send({
              from: 'WE Academy <noreply@wemarketingdigital.com.br>',
              to: alertEmail,
              subject: `⚠️ Alerta: Usuário excedeu limite de custo - ${userItem.email}`,
              html: `
                <h2>Alerta de Custo - Laboratório de IA</h2>
                <p>O usuário <strong>${userItem.email}</strong> excedeu o limite de custo configurado.</p>
                <ul>
                  <li><strong>Limite configurado:</strong> $${maxCost.toFixed(4)}</li>
                  <li><strong>Custo atual:</strong> $${totalCost.toFixed(4)}</li>
                  <li><strong>Excesso:</strong> $${(totalCost - maxCost).toFixed(4)}</li>
                </ul>
                <p>Ação recomendada: Revisar o uso do usuário ou ajustar os limites.</p>
              `,
            })
            
            // Marcar alerta como enviado (buscar o último inserido)
            const { data: insertedAlert } = await serviceRoleSupabase
              .from('lab_cost_alerts')
              .select('id')
              .eq('user_id', userItem.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (insertedAlert) {
              await serviceRoleSupabase
                .from('lab_cost_alerts')
                .update({ alert_sent: true })
                .eq('id', insertedAlert.id)
            }
          } catch (emailError) {
            console.error('Error sending email:', emailError)
          }
          
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
