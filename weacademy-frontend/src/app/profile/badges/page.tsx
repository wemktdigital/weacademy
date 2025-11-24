'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGamification } from '@/hooks/useGamification'
import { AchievementBadge } from '@/components/gamification'
import { cn } from '@/lib/utils'
import {
  Trophy,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle2,
  Lock,
} from 'lucide-react'

const CATEGORIES = ['all', 'courses', 'quizzes', 'lab-ia', 'community', 'special'] as const
const RARITIES = ['all', 'common', 'rare', 'epic', 'legendary'] as const

const CATEGORY_LABELS = {
  all: 'Todas',
  courses: 'Cursos',
  quizzes: 'Quizzes',
  'lab-ia': 'Lab IA',
  community: 'Comunidade',
  special: 'Especial',
}

const RARITY_LABELS = {
  all: 'Todas',
  common: 'Comum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
}

export default function BadgesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { achievements, loading } = useGamification()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }
  }, [user, authLoading, router])

  const filteredAchievements = achievements.filter((achievement) => {
    const matchesSearch =
      achievement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      achievement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      achievement.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || achievement.category === categoryFilter
    const matchesRarity = rarityFilter === 'all' || achievement.rarity === rarityFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'unlocked' && achievement.unlocked) ||
      (statusFilter === 'locked' && !achievement.unlocked)

    return matchesSearch && matchesCategory && matchesRarity && matchesStatus
  })

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const lockedCount = achievements.filter(a => !a.unlocked).length
  const progressPercentage = achievements.length > 0
    ? Math.round((unlockedCount / achievements.length) * 100)
    : 0

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
            <div className="flex items-center gap-4">
              <Link href="/profile/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center space-x-2">
                  <Trophy className="h-8 w-8 text-primary" />
                  <span>Meus Badges</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  {unlockedCount} de {achievements.length} badges desbloqueados ({progressPercentage}%)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Stats Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Badges</p>
                  <p className="text-2xl font-bold">{achievements.length}</p>
                </div>
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Desbloqueados</p>
                  <p className="text-2xl font-bold text-green-600">{unlockedCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bloqueados</p>
                  <p className="text-2xl font-bold text-muted-foreground">{lockedCount}</p>
                </div>
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar badges..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rarityFilter} onValueChange={setRarityFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Raridade" />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((rarity) => (
                    <SelectItem key={rarity} value={rarity}>
                      {RARITY_LABELS[rarity]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unlocked">Desbloqueados</SelectItem>
                  <SelectItem value="locked">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Achievements Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>
              {filteredAchievements.length} badge(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAchievements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum badge encontrado</p>
                <p className="text-sm mt-2">Tente ajustar os filtros</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {filteredAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={cn(
                      'flex flex-col items-center gap-3 p-4 rounded-lg border transition-colors',
                      achievement.unlocked
                        ? 'bg-background hover:bg-accent'
                        : 'bg-muted/50 opacity-60'
                    )}
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
                    <div className="text-center space-y-1 w-full">
                      <p className="text-sm font-medium">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {achievement.description}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {achievement.rarity}
                        </Badge>
                        {achievement.unlocked && achievement.unlocked_at && (
                          <Badge variant="secondary" className="text-xs">
                            {new Date(achievement.unlocked_at).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}
                      </div>
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

