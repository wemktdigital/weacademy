import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = "force-dynamic"

async function authenticateUser(request: NextRequest) {
  let user = null
  
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
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
  
  if (!user) {
    const sb = await supabaseServer()
    const { data: { user: cookieUser }, error: authErr } = await sb.auth.getUser()
    if (!authErr && cookieUser) {
      user = cookieUser
    }
  }

  return user
}

/**
 * GET /api/gamification/xp-history
 * Retorna histórico de XP agrupado por período (dia, semana, mês)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await authenticateUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // '7d' | '30d' | '90d' | 'all'
    const groupBy = searchParams.get('groupBy') || 'day' // 'day' | 'week' | 'month'

    // Calcular data inicial baseado no período
    let startDate: Date | null = null
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar pontos do usuário no período
    let query = supabase
      .from('user_points')
      .select('points, created_at, source_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data: pointsData, error } = await query

    if (error) {
      console.error('Error fetching XP history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Agrupar por período
    const grouped: Record<string, number> = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    pointsData?.forEach((point) => {
      const date = new Date(point.created_at)
      let key: string

      if (groupBy === 'day') {
        // Agrupar por dia
        key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      } else if (groupBy === 'week') {
        // Agrupar por semana (semana começa na segunda)
        const weekStart = new Date(date)
        const day = weekStart.getDay()
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1) // Ajustar para segunda
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)
        key = `Sem ${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
      } else {
        // Agrupar por mês
        key = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      }

      if (!grouped[key]) {
        grouped[key] = 0
      }
      grouped[key] += point.points
    })

    // Converter para array e calcular XP acumulado
    const history = Object.entries(grouped)
      .map(([date, points]) => ({
        date,
        xp: points,
        cumulativeXp: 0, // Será calculado abaixo
      }))
      .sort((a, b) => {
        // Ordenar por data
        const dateA = new Date(a.date.split('/').reverse().join('-'))
        const dateB = new Date(b.date.split('/').reverse().join('-'))
        return dateA.getTime() - dateB.getTime()
      })

    // Calcular XP acumulado
    let cumulative = 0
    history.forEach((item) => {
      cumulative += item.xp
      item.cumulativeXp = cumulative
    })

    // Calcular estatísticas
    const totalXP = history.reduce((sum, item) => sum + item.xp, 0)
    const avgDailyXP = history.length > 0 ? Math.round(totalXP / history.length) : 0
    const maxDailyXP = history.length > 0 ? Math.max(...history.map(item => item.xp)) : 0
    const currentStreak = calculateStreak(pointsData || [])

    return NextResponse.json({
      history,
      stats: {
        totalXP,
        avgDailyXP,
        maxDailyXP,
        currentStreak,
        period,
        groupBy,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/xp-history:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar histórico de XP' },
      { status: 500 }
    )
  }
}

/**
 * Calcula a sequência atual de dias consecutivos com XP
 */
function calculateStreak(pointsData: Array<{ created_at: string; points: number }>): number {
  if (pointsData.length === 0) return 0

  // Agrupar por dia
  const dailyXP: Record<string, boolean> = {}
  pointsData.forEach((point) => {
    const date = new Date(point.created_at)
    const dayKey = date.toLocaleDateString('en-US') // Formato consistente
    dailyXP[dayKey] = true
  })

  // Calcular streak
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  let currentDate = new Date(today)

  while (true) {
    const dayKey = currentDate.toLocaleDateString('en-US')
    if (dailyXP[dayKey]) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

