'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { 
  TrendingUp, 
  Users, 
  MousePointerClick, 
  Eye,
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react'

interface EventStats {
  event_name: string
  event_count: number
  unique_users: number
}

interface EventsByDate {
  date: string
  event_count: number
}

interface RecentEvent {
  id: string
  user_email: string
  event_name: string
  created_at: string
}

export default function AnalyticsPage() {
  const { user, isAdmin } = useAuth()
  const [eventStats, setEventStats] = useState<EventStats[]>([])
  const [eventsByDate, setEventsByDate] = useState<EventsByDate[]>([])
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [totalEvents, setTotalEvents] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  // Cores para os gráficos
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

  // Carregar estatísticas de eventos
  const fetchEventStats = async () => {
    if (!user || !isAdmin) return

    setLoading(true)
    try {
      // Calcular datas
      let startDate = null
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
        startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
      }

      // Buscar estatísticas de eventos
      const { data: stats, error: statsError } = await supabase
        .rpc('get_event_stats', {
          start_date: startDate?.toISOString() || null,
          end_date: null,
          limit_count: 10
        })

      if (statsError) throw statsError

      setEventStats(stats || [])

      // Buscar eventos por data
      const { data: byDate, error: byDateError } = await supabase
        .rpc('get_events_by_date', {
          start_date: startDate?.toISOString() || null,
          end_date: null
        })

      if (byDateError) throw byDateError

      // Formatar datas
      const formattedByDate = (byDate || []).map(item => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        event_count: Number(item.event_count)
      })).reverse()

      setEventsByDate(formattedByDate)

      // Buscar eventos recentes
      const { data: recent, error: recentError } = await supabase
        .rpc('get_recent_events', {
          limit_count: 20
        })

      if (recentError) throw recentError

      setRecentEvents((recent || []).map(e => ({
        id: e.id,
        user_email: e.user_email || 'Usuário Anônimo',
        event_name: e.event_name,
        created_at: e.created_at
      })))

      // Calcular totais
      const total = (stats || []).reduce((sum, stat) => sum + stat.event_count, 0)
      const uniqueUsers = new Set((recent || []).map(e => e.user_id)).size
      
      setTotalEvents(total)
      setTotalUsers(uniqueUsers)
    } catch (error) {
      console.error('Erro ao carregar analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && isAdmin) {
      fetchEventStats()
    }
  }, [user, isAdmin, dateRange])

  // Verificar acesso
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Acesso Negado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Apenas administradores podem acessar as análises.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <span>Analytics</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Estatísticas e métricas de eventos do sistema
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="all">Todo o período</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Eventos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center space-x-2">
                <MousePointerClick className="h-5 w-5 text-primary" />
                <span>{loading ? '...' : totalEvents.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dateRange !== 'all' && `Últimos ${dateRange}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Usuários Únicos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-600" />
                <span>{loading ? '...' : totalUsers}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dateRange !== 'all' && `Últimos ${dateRange}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Visualizações de Página</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center space-x-2">
                <Eye className="h-5 w-5 text-blue-600" />
                <span>
                  {loading ? '...' : 
                    eventStats.find(s => s.event_name === 'page_view')?.event_count || 0
                  }
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Page views</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tipos de Eventos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <span>{loading ? '...' : eventStats.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Categorias únicas</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Events Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Top Eventos</CardTitle>
              <CardDescription>Eventos mais frequentes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={eventStats.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="event_name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="event_count" fill="#8884d8" name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Events Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Eventos</CardTitle>
              <CardDescription>Proporção de cada tipo</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={eventStats.slice(0, 5)}
                      dataKey="event_count"
                      nameKey="event_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {eventStats.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos ao Longo do Tempo</CardTitle>
            <CardDescription>Evolução temporal dos eventos</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={eventsByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="event_count" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Eventos"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos Recentes</CardTitle>
            <CardDescription>Últimas atividades registradas</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Usuário</th>
                      <th className="text-left p-2">Evento</th>
                      <th className="text-left p-2">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-muted-foreground">
                          Nenhum evento encontrado
                        </td>
                      </tr>
                    ) : (
                      recentEvents.map((event) => (
                        <tr key={event.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">{event.user_email}</td>
                          <td className="p-2">
                            <Badge variant="secondary">{event.event_name}</Badge>
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {formatDate(event.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
