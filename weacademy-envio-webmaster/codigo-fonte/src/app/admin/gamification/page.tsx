'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Star,
  TrendingUp,
  Users,
  Settings,
  BarChart3,
  Plus,
  Award,
  Target,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function GamificationAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalAchievements: 0,
    totalLevels: 0,
    activeUsers: 0,
    engagementRate: 0,
  })

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/access-denied')
      return
    }

    if (isAdmin) {
      loadStats()
    }
  }, [user, isAdmin, authLoading, router])

  const loadStats = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const [achievementsRes, levelsRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/gamification/achievements?include_stats=true', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/gamification/levels?include_stats=true', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/gamification/analytics', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (!achievementsRes.ok || !levelsRes.ok || !analyticsRes.ok) {
        throw new Error('Erro ao buscar estatísticas')
      }

      const [achievementsData, levelsData, analyticsData] = await Promise.all([
        achievementsRes.json(),
        levelsRes.json(),
        analyticsRes.json(),
      ])

      setStats({
        totalAchievements: achievementsData.total || 0,
        totalLevels: levelsData.total || 0,
        activeUsers: analyticsData.analytics?.overview?.active_users || 0,
        engagementRate: analyticsData.analytics?.overview?.engagement_rate || 0,
      })
    } catch (error: any) {
      console.error('Error loading stats:', error)
      toast.error(error.message || 'Erro ao carregar estatísticas')
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-2">
                <Trophy className="h-8 w-8 text-primary" />
                <span>Gamificação</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie achievements, níveis e configurações de gamificação
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Achievements</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAchievements}</div>
              <p className="text-xs text-muted-foreground">Badges disponíveis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Níveis</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLevels}</div>
              <p className="text-xs text-muted-foreground">Níveis configurados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Engajados na gamificação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Engajamento</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.engagementRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Usuários ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link href="/admin/gamification/achievements">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Achievements
                  </CardTitle>
                  <Badge variant="outline">{stats.totalAchievements}</Badge>
                </div>
                <CardDescription>
                  Gerencie badges e conquistas dos usuários
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Gerenciar Achievements
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/gamification/levels">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Níveis
                  </CardTitle>
                  <Badge variant="outline">{stats.totalLevels}</Badge>
                </div>
                <CardDescription>
                  Configure níveis e requisitos de XP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Gerenciar Níveis
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/gamification/settings">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Configurações
                </CardTitle>
                <CardDescription>
                  Configure opções gerais de gamificação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Configurações
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/gamification/analytics">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Analytics
                </CardTitle>
                <CardDescription>
                  Visualize estatísticas e métricas de gamificação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Ver Analytics
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

