'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Users,
  Trophy,
  Star,
  Award,
  Target,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AnalyticsData {
  overview: {
    total_users: number
    active_users: number
    engagement_rate: number
    total_achievements: number
    total_levels: number
  }
  level_distribution: Record<number, number>
  top_users: Array<{
    user_id: string
    full_name: string | null
    avatar_url: string | null
    total_xp: number
    current_level: number
  }>
  most_unlocked_achievements: Array<{
    id: string
    name: string
    code: string
    icon: string
    unlocked_count: number
  }>
}

export default function GamificationAnalyticsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all-time'>('all-time')

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/access-denied')
      return
    }

    if (isAdmin) {
      loadAnalytics()
    }
  }, [user, isAdmin, authLoading, router, period])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/gamification/analytics', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar analytics')
      }

      const data = await response.json()
      setAnalytics(data.analytics || null)
    } catch (error: any) {
      console.error('Error loading analytics:', error)
      toast.error(error.message || 'Erro ao carregar analytics')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/gamification">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center space-x-2">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <span>Analytics de Gamificação</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  Visualize estatísticas e métricas de gamificação
                </p>
              </div>
            </div>
            <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="all-time">Todos os Tempos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overview.total_users}</div>
              <p className="text-xs text-muted-foreground">Usuários cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overview.active_users}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.overview.engagement_rate.toFixed(1)}% de engajamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Achievements</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overview.total_achievements}</div>
              <p className="text-xs text-muted-foreground">Badges disponíveis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Níveis</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overview.total_levels}</div>
              <p className="text-xs text-muted-foreground">Níveis configurados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Engajamento</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overview.engagement_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Usuários engajados</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Usuários
            </CardTitle>
            <CardDescription>Usuários com mais XP acumulado</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">XP Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.top_users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  analytics.top_users.map((user, index) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <Badge variant="outline">{index + 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                              {user.full_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.full_name || 'Usuário Anônimo'}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.user_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Nível {user.current_level}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {user.total_xp.toLocaleString()} XP
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Most Unlocked Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Achievements Mais Desbloqueados
            </CardTitle>
            <CardDescription>Badges mais populares entre os usuários</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead className="w-[80px]">Ícone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Desbloqueados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.most_unlocked_achievements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum achievement encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  analytics.most_unlocked_achievements.map((achievement, index) => (
                    <TableRow key={achievement.id}>
                      <TableCell>
                        <Badge variant="outline">{index + 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-2xl">{achievement.icon || '🏆'}</span>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{achievement.name}</p>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {achievement.code}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {achievement.unlocked_count} usuário(s)
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Distribuição de Níveis
            </CardTitle>
            <CardDescription>Quantidade de usuários por nível</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.level_distribution).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum dado de distribuição disponível
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(analytics.level_distribution)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([level, count]) => (
                    <div key={level} className="flex items-center gap-4">
                      <div className="w-20">
                        <Badge variant="secondary">Nível {level}</Badge>
                      </div>
                      <div className="flex-1">
                        <div className="h-8 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full flex items-center justify-end pr-4 text-sm font-medium text-primary-foreground"
                            style={{
                              width: `${(count / analytics.overview.active_users) * 100}%`,
                            }}
                          >
                            {count > 0 && count}
                          </div>
                        </div>
                      </div>
                      <div className="w-20 text-right text-sm font-medium">
                        {count} usuário(s)
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

