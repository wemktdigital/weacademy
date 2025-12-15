'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts'
import { TrendingUp, Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface XPHistoryItem {
  date: string
  xp: number
  cumulativeXp: number
}

interface XPHistoryStats {
  totalXP: number
  avgDailyXP: number
  maxDailyXP: number
  currentStreak: number
  period: string
  groupBy: string
}

interface XPProgressChartProps {
  className?: string
}

export function XPProgressChart({ className }: XPProgressChartProps) {
  const { user } = useAuth()
  const [history, setHistory] = useState<XPHistoryItem[]>([])
  const [stats, setStats] = useState<XPHistoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area')

  useEffect(() => {
    if (user) {
      fetchXPHistory()
    }
  }, [user, period, groupBy])

  const fetchXPHistory = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data: sessionData, error: sessionError } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      
      if (sessionError || !sessionData?.session) {
        console.warn('No active session for XP history:', sessionError)
        setLoading(false)
        return
      }

      const token = sessionData.session.access_token

      if (!token) {
        console.warn('No access token for XP history')
        setLoading(false)
        return
      }

      let response: Response
      try {
        response = await fetch(
          `/api/gamification/xp-history?period=${period}&groupBy=${groupBy}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
      } catch (fetchError: any) {
        // Erro de rede (Failed to fetch) - não é um erro crítico
        console.warn('Network error fetching XP history:', fetchError?.message || fetchError)
        setLoading(false)
        return
      }

      if (!response.ok) {
        // Se for erro 401, não é um erro crítico
        if (response.status === 401) {
          console.warn('User not authenticated for XP history')
          setLoading(false)
          return
        }

        // Tentar ler mensagem de erro
        let errorMessage = 'Erro ao buscar histórico de XP'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch {
          // Se não conseguir parsear, usar mensagem padrão
        }
        
        // Usar console.warn para erros HTTP (não críticos)
        console.warn('Error fetching XP history:', errorMessage)
        setLoading(false)
        return
      }

      const data = await response.json()
      setHistory(data.history || [])
      setStats(data.stats || null)
    } catch (error: any) {
      // Erros de rede ou outros erros não relacionados a HTTP
      // Para erros de rede, usar console.warn em vez de console.error
      const isNetworkError = error?.message === 'Failed to fetch' || 
                            error?.name === 'TypeError' ||
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('network')
      
      if (isNetworkError) {
        console.warn('Network error fetching XP history:', error?.message || error)
      } else {
        console.error('Error fetching XP history:', error?.message || error)
      }
      // Não setar estado de erro para não quebrar a UI
    } finally {
      setLoading(false)
    }
  }

  const formatPeriodLabel = (period: string) => {
    switch (period) {
      case '7d': return 'Últimos 7 dias'
      case '30d': return 'Últimos 30 dias'
      case '90d': return 'Últimos 90 dias'
      case 'all': return 'Todo o período'
      default: return period
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução de XP
          </CardTitle>
          <CardDescription>Seu progresso ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução de XP
          </CardTitle>
          <CardDescription>Seu progresso ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum dado de XP encontrado</p>
            <p className="text-sm mt-2">Complete atividades para começar a ganhar XP!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução de XP
            </CardTitle>
            <CardDescription>
              {formatPeriodLabel(period)} · {stats?.totalXP || 0} XP total
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as any)}>
              <TabsList size="sm">
                <TabsTrigger value="area">Área</TabsTrigger>
                <TabsTrigger value="line">Linha</TabsTrigger>
                <TabsTrigger value="bar">Barras</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList size="sm">
              <TabsTrigger value="7d">7 dias</TabsTrigger>
              <TabsTrigger value="30d">30 dias</TabsTrigger>
              <TabsTrigger value="90d">90 dias</TabsTrigger>
              <TabsTrigger value="all">Todo</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {period !== '7d' && (
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <TabsList size="sm">
                <TabsTrigger value="day">Por dia</TabsTrigger>
                <TabsTrigger value="week">Por semana</TabsTrigger>
                <TabsTrigger value="month">Por mês</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* Gráfico */}
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value} XP`, 'XP']}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeXp"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorXp)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="xp"
                  stroke="hsl(var(--primary))"
                  fillOpacity={0.5}
                  fill="url(#colorXp)"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            ) : chartType === 'line' ? (
              <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value} XP`, 'XP']}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeXp"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              </LineChart>
            ) : (
              <BarChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value} XP`, 'XP']}
                />
                <Bar dataKey="xp" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalXP}</div>
              <div className="text-xs text-muted-foreground">XP Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.avgDailyXP}</div>
              <div className="text-xs text-muted-foreground">XP Médio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.maxDailyXP}</div>
              <div className="text-xs text-muted-foreground">XP Máximo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.currentStreak}</div>
              <div className="text-xs text-muted-foreground">Dias Sequência</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

