'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGamification } from '@/hooks/useGamification'
import { LeaderboardCard } from '@/components/gamification'
import {
  Trophy,
  Crown,
  TrendingUp,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { fetchLeaderboard } = useGamification()
  const [loading, setLoading] = useState(true)
  const [leaderboards, setLeaderboards] = useState<{
    weekly: any[]
    monthly: any[]
    'all-time': any[]
  }>({
    weekly: [],
    monthly: [],
    'all-time': [],
  })
  const [activePeriod, setActivePeriod] = useState<'weekly' | 'monthly' | 'all-time'>('all-time')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      loadLeaderboards()
    }
  }, [user, authLoading, router])

  const loadLeaderboards = async () => {
    try {
      setLoading(true)

      const [weekly, monthly, allTime] = await Promise.all([
        fetchLeaderboard('weekly', 100),
        fetchLeaderboard('monthly', 100),
        fetchLeaderboard('all-time', 100),
      ])

      setLeaderboards({
        weekly,
        monthly,
        'all-time': allTime,
      })
    } catch (error: any) {
      console.error('Error loading leaderboards:', error)
      toast.error('Erro ao carregar rankings')
    } finally {
      setLoading(false)
    }
  }

  const currentLeaderboard = leaderboards[activePeriod]
  const userRank = currentLeaderboard.findIndex(
    entry => entry.user_id === user?.id || entry.is_current_user
  ) + 1

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
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2">
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                <span>Ranking</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Veja como você se compara com outros usuários
              </p>
            </div>
            <Button variant="outline" onClick={loadLeaderboards} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'motion-safe:animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Top 3 */}
        {currentLeaderboard.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 2nd Place */}
            {currentLeaderboard[1] && (
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-bl-lg">
                  <span className="text-2xl font-bold">🥈</span>
                </div>
                <CardContent className="pt-12 pb-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-6xl">🥈</div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">
                        {currentLeaderboard[1].user.full_name || 'Usuário Anônimo'}
                      </p>
                      <p className="text-muted-foreground text-sm">2º lugar</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">
                        {currentLeaderboard[1].points.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 1st Place */}
            {currentLeaderboard[0] && (
              <Card className="relative overflow-hidden border-primary border-2 md:scale-105">
                <div className="absolute top-0 right-0 bg-yellow-200 dark:bg-yellow-900 px-3 py-1 rounded-bl-lg">
                  <span className="text-2xl font-bold">🥇</span>
                </div>
                <CardContent className="pt-12 pb-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-6xl">👑</div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">
                        {currentLeaderboard[0].user.full_name || 'Usuário Anônimo'}
                      </p>
                      <p className="text-muted-foreground text-sm">1º lugar</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">
                        {currentLeaderboard[0].points.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3rd Place */}
            {currentLeaderboard[2] && (
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-orange-200 dark:bg-orange-900 px-3 py-1 rounded-bl-lg">
                  <span className="text-2xl font-bold">🥉</span>
                </div>
                <CardContent className="pt-12 pb-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-6xl">🥉</div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">
                        {currentLeaderboard[2].user.full_name || 'Usuário Anônimo'}
                      </p>
                      <p className="text-muted-foreground text-sm">3º lugar</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">
                        {currentLeaderboard[2].points.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Period Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ranking</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={activePeriod === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActivePeriod('weekly')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Semanal
                </Button>
                <Button
                  variant={activePeriod === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActivePeriod('monthly')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Mensal
                </Button>
                <Button
                  variant={activePeriod === 'all-time' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActivePeriod('all-time')}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Geral
                </Button>
              </div>
            </div>
            {userRank > 0 && (
              <CardDescription>
                Sua posição: #{userRank}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <LeaderboardCard
              entries={currentLeaderboard}
              period={activePeriod}
              currentUserId={user?.id}
              showTop={100}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

