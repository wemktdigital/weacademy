'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGamification } from '@/hooks/useGamification'
import { useGamificationNotifications } from '@/hooks/useGamificationNotifications'
import {
  GamificationStats,
  LevelProgress,
  StreakDisplay,
  PointsDisplay,
  AchievementBadge,
  XPProgressChart,
  PersonalizedInsights,
  LevelUpModal,
  AchievementUnlockModal,
} from '@/components/gamification'
import { ClickableCard } from '@/components/ui/clickable-card'
import { AccessibleFilters } from '@/components/ui/accessible-filters'
import {
  Trophy,
  Star,
  Flame,
  TrendingUp,
  Award,
  Target,
  BarChart3,
  ArrowRight,
  BookOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export default function GamificationDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { stats, achievements, loading, refresh } = useGamification()
  const { 
    showLevelUp, 
    levelUpData, 
    showAchievementUnlock, 
    achievementUnlockData,
    onCloseLevelUp,
    onCloseAchievementUnlock,
  } = useGamificationNotifications()
  const [recentAchievements, setRecentAchievements] = useState<any[]>([])
  const [achievementSearch, setAchievementSearch] = useState('')
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'unlocked' | 'locked'>('all')
  const [achievementSort, setAchievementSort] = useState<'recent' | 'rarity' | 'name'>('recent')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      refresh()
    }
  }, [user, authLoading, router, refresh])

  useEffect(() => {
    if (achievements) {
      // Pegar achievements desbloqueados recentemente (últimos 5)
      const unlocked = achievements
        .filter(a => a.unlocked)
        .sort((a, b) => {
          const dateA = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0
          const dateB = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0
          return dateB - dateA
        })
        .slice(0, 5)
      
      setRecentAchievements(unlocked)
    }
  }, [achievements])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Valores padrão quando stats não está disponível
  const defaultStats = {
    total_xp: 0,
    current_level: 1,
    level_xp: 0,
    next_level_xp: 100,
    achievements_unlocked: 0,
    achievements_total: 0,
    current_streak: 0,
    longest_streak: 0,
    courses_completed: 0,
    lessons_completed: 0,
    quizzes_passed: 0,
    certificates_earned: 0,
  }

  const currentStats = stats || defaultStats
  const unlockedCount = (achievements || []).filter(a => a.unlocked).length
  const lockedCount = (achievements || []).filter(a => !a.unlocked).length
  const progressPercentage = currentStats.achievements_total > 0
    ? Math.round((currentStats.achievements_unlocked / currentStats.achievements_total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2">
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                <span>Meu Dashboard</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Acompanhe seu progresso e conquistas
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Link href="/leaderboard" className="flex-1 sm:flex-none">
                <Button variant="outline" className="w-full sm:w-auto">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ranking
                </Button>
              </Link>
              <Link href="/profile/badges" className="flex-1 sm:flex-none">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Award className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Ver Todos os Badges</span>
                  <span className="sm:hidden">Badges</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Mensagem de aviso se dados não estiverem disponíveis */}
        {!loading && !stats && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    Dados de gamificação temporariamente indisponíveis
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Algumas informações podem não estar disponíveis. A página continuará funcionando normalmente.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refresh()}
                  className="ml-auto"
                >
                  Recarregar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <GamificationStats
          totalXP={currentStats.total_xp}
          currentLevel={currentStats.current_level}
          achievementsUnlocked={currentStats.achievements_unlocked}
          totalAchievements={currentStats.achievements_total}
          currentStreak={currentStats.current_streak}
          longestStreak={currentStats.longest_streak}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Nível e Progresso */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Progresso do Nível
              </CardTitle>
              <CardDescription>
                Seu progresso em direção ao próximo nível
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <LevelProgress
                currentLevel={currentStats.current_level}
                currentXP={currentStats.level_xp}
                nextLevelXP={currentStats.next_level_xp}
                showLabel
                showPercentage
                showXPValues
                size="lg"
              />

              {/* Estatísticas de Atividade */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentStats.courses_completed}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    Cursos
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentStats.lessons_completed}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Aulas
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentStats.quizzes_passed}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <FileText className="h-3 w-3" />
                    Quizzes
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentStats.certificates_earned}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Award className="h-3 w-3" />
                    Certificados
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sequência */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Sequência de Estudos
              </CardTitle>
              <CardDescription>
                Mantenha sua sequência para ganhar bônus!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StreakDisplay
                currentStreak={currentStats.current_streak}
                longestStreak={currentStats.longest_streak}
                showLabel
                size="lg"
                variant="detailed"
              />
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Continue estudando para manter sua sequência e ganhar bônus de XP!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Progresso de XP */}
        {stats && (
          <XPProgressChart />
        )}

        {/* Achievements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Conquistas
                </CardTitle>
                <CardDescription>
                  {currentStats.achievements_unlocked} de {currentStats.achievements_total} badges desbloqueados ({progressPercentage}%)
                </CardDescription>
              </div>
              <Link href="/profile/badges">
                <Button variant="outline" size="sm">
                  Ver Todos
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros e Busca */}
            <AccessibleFilters
              searchValue={achievementSearch}
              onSearchChange={setAchievementSearch}
              searchPlaceholder="Buscar badges..."
              searchLabel="Buscar badges"
              filters={[
                {
                  id: 'status',
                  label: 'Status',
                  value: achievementFilter,
                  options: [
                    { value: 'all', label: 'Todos' },
                    { value: 'unlocked', label: 'Desbloqueados' },
                    { value: 'locked', label: 'Bloqueados' },
                  ],
                  onChange: (value) => setAchievementFilter(value as any),
                },
              ]}
              sort={{
                value: achievementSort,
                options: [
                  { value: 'recent', label: 'Mais recentes' },
                  { value: 'rarity', label: 'Raridade' },
                  { value: 'name', label: 'Nome' },
                ],
                onChange: (value) => setAchievementSort(value as any),
              }}
              showClearButton
              onClear={() => {
                setAchievementSearch('')
                setAchievementFilter('all')
                setAchievementSort('recent')
              }}
            />

            <Tabs defaultValue="recent" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recent">Recentes</TabsTrigger>
                <TabsTrigger value="unlocked">Desbloqueados ({unlockedCount})</TabsTrigger>
                <TabsTrigger value="locked">Bloqueados ({lockedCount})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="recent" className="mt-4">
                {recentAchievements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Nenhuma conquista recente</p>
                    <p className="text-sm mt-2">Complete atividades para desbloquear badges!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {recentAchievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <AchievementBadge
                          icon={achievement.icon}
                          name={achievement.name}
                          description={achievement.description}
                          rarity={achievement.rarity}
                          unlocked={achievement.unlocked}
                          unlockedAt={achievement.unlocked_at}
                          size="lg"
                          showTooltip
                        />
                        <p className="text-sm font-medium text-center">{achievement.name}</p>
                        {achievement.unlocked_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(achievement.unlocked_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="unlocked" className="mt-4">
                {(() => {
                  // Filtrar e ordenar achievements desbloqueados
                  let filtered = (achievements || []).filter(a => a.unlocked)

                  // Aplicar busca
                  if (achievementSearch) {
                    const searchLower = achievementSearch.toLowerCase()
                    filtered = filtered.filter(a =>
                      a.name.toLowerCase().includes(searchLower) ||
                      a.description?.toLowerCase().includes(searchLower)
                    )
                  }

                  // Aplicar filtro de status
                  if (achievementFilter === 'locked') {
                    filtered = []
                  }

                  // Aplicar ordenação
                  if (achievementSort === 'name') {
                    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
                  } else if (achievementSort === 'rarity') {
                    const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }
                    filtered = [...filtered].sort((a, b) => 
                      (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0)
                    )
                  } else if (achievementSort === 'recent') {
                    filtered = [...filtered].sort((a, b) => {
                      const dateA = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0
                      const dateB = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0
                      return dateB - dateA
                    })
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhum badge encontrado</p>
                        <p className="text-sm mt-2">Ajuste os filtros para ver mais resultados</p>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filtered.map((achievement) => (
                        <ClickableCard
                          key={achievement.id}
                          title={achievement.name}
                          description={achievement.description}
                          href={`/profile/badges#${achievement.id}`}
                          className="p-0"
                          showArrow={false}
                        >
                          <div className="flex flex-col items-center gap-2 p-4">
                            <AchievementBadge
                              icon={achievement.icon}
                              name={achievement.name}
                              description={achievement.description}
                              rarity={achievement.rarity}
                              unlocked={achievement.unlocked}
                              unlockedAt={achievement.unlocked_at}
                              size="lg"
                              showTooltip
                            />
                            <p className="text-sm font-medium text-center">{achievement.name}</p>
                          </div>
                        </ClickableCard>
                      ))}
                  </div>
                  )
                })()}
              </TabsContent>
              
              <TabsContent value="locked" className="mt-4">
                {(() => {
                  // Filtrar e ordenar achievements bloqueados
                  let filtered = (achievements || []).filter(a => !a.unlocked)

                  // Aplicar busca
                  if (achievementSearch) {
                    const searchLower = achievementSearch.toLowerCase()
                    filtered = filtered.filter(a =>
                      a.name.toLowerCase().includes(searchLower) ||
                      a.description?.toLowerCase().includes(searchLower)
                    )
                  }

                  // Aplicar filtro de status
                  if (achievementFilter === 'unlocked') {
                    filtered = []
                  }

                  // Aplicar ordenação
                  if (achievementSort === 'name') {
                    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
                  } else if (achievementSort === 'rarity') {
                    const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }
                    filtered = [...filtered].sort((a, b) => 
                      (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0)
                    )
                  }

                  if (filtered.length === 0) {
                    if (lockedCount === 0) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>Parabéns! Você desbloqueou todos os badges!</p>
                        </div>
                      )
                    }
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhum badge encontrado</p>
                        <p className="text-sm mt-2">Ajuste os filtros para ver mais resultados</p>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filtered.map((achievement) => (
                        <ClickableCard
                          key={achievement.id}
                          title={achievement.name}
                          description={achievement.description}
                          href={`/profile/badges#${achievement.id}`}
                          className="p-0 opacity-60"
                          showArrow={false}
                        >
                          <div className="flex flex-col items-center gap-2 p-4">
                          <AchievementBadge
                            icon={achievement.icon}
                            name={achievement.name}
                            description={achievement.description}
                            rarity={achievement.rarity}
                            unlocked={false}
                            size="lg"
                            showTooltip
                          />
                          <p className="text-sm font-medium text-center">{achievement.name}</p>
                          </div>
                        </ClickableCard>
                      ))}
                  </div>
                  )
                })()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modais de Gamificação */}
      {showLevelUp && levelUpData && (
        <LevelUpModal
          open={showLevelUp}
          newLevel={levelUpData.level}
          levelName={levelUpData.levelName}
          onClose={onCloseLevelUp}
        />
      )}

      {showAchievementUnlock && achievementUnlockData && (
        <AchievementUnlockModal
          open={showAchievementUnlock}
          achievement={achievementUnlockData}
          onClose={onCloseAchievementUnlock}
        />
      )}
    </div>
  )
}

