'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, Crown } from 'lucide-react'

export interface LeaderboardEntry {
  rank: number
  user_id: string
  points: number
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  is_current_user?: boolean
}

export interface LeaderboardCardProps {
  entries: LeaderboardEntry[]
  period?: 'weekly' | 'monthly' | 'all-time'
  title?: string
  showTop?: number
  currentUserId?: string
  className?: string
}

const RANK_ICONS = {
  1: Crown,
  2: Trophy,
  3: Medal,
}

const RANK_COLORS = {
  1: 'text-yellow-500 dark:text-yellow-400',
  2: 'text-gray-400 dark:text-gray-500',
  3: 'text-orange-600 dark:text-orange-500',
}

const PERIOD_LABELS = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  'all-time': 'Geral',
}

export function LeaderboardCard({
  entries,
  period = 'all-time',
  title,
  showTop = 10,
  currentUserId,
  className,
}: LeaderboardCardProps) {
  const displayedEntries = entries.slice(0, showTop)
  const userRank = currentUserId
    ? entries.findIndex(e => e.user_id === currentUserId) + 1
    : null

  const getRankDisplay = (rank: number) => {
    const Icon = RANK_ICONS[rank as keyof typeof RANK_ICONS]
    
    if (Icon) {
      return (
        <Icon
          className={cn(
            'h-5 w-5',
            RANK_COLORS[rank as keyof typeof RANK_COLORS]
          )}
        />
      )
    }
    
    return (
      <span className="text-muted-foreground font-semibold text-sm">
        #{rank}
      </span>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title || 'Ranking'}</span>
          <Badge variant="outline">{PERIOD_LABELS[period]}</Badge>
        </CardTitle>
        <CardDescription>
          Top {showTop} usuários com mais XP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2" role="table" aria-label={`Ranking ${PERIOD_LABELS[period]}`}>
          <div className="sr-only" role="row">
            <span role="columnheader">Posição</span>
            <span role="columnheader">Usuário</span>
            <span role="columnheader">XP</span>
          </div>
          {displayedEntries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground" role="status">
              Nenhum usuário no ranking ainda
            </p>
          ) : (
            displayedEntries.map((entry, index) => {
              const isCurrentUser = entry.is_current_user || entry.user_id === currentUserId
              
              return (
                <div
                  key={entry.user_id}
                  role="row"
                  aria-label={`Posição ${entry.rank}: ${entry.user.full_name || 'Usuário Anônimo'} com ${entry.points.toLocaleString('pt-BR')} XP`}
                  className={cn(
                    'flex items-center gap-3 p-2 sm:p-3 rounded-lg transition-colors duration-200',
                    isCurrentUser && 'bg-primary/10 border border-primary/20',
                    !isCurrentUser && 'motion-safe:hover:bg-accent',
                    'flex-wrap sm:flex-nowrap'
                  )}
                >
                  <div className="flex-shrink-0 w-8 flex items-center justify-center" role="gridcell">
                    {getRankDisplay(entry.rank)}
                  </div>
                  
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarImage src={entry.user.avatar_url || undefined} alt={`Avatar de ${entry.user.full_name || 'Usuário Anônimo'}`} />
                    <AvatarFallback aria-hidden="true">
                      {entry.user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0" role="gridcell">
                    <p
                      className={cn(
                        'font-medium truncate text-sm sm:text-base',
                        isCurrentUser && 'text-primary font-semibold'
                      )}
                    >
                      {entry.user.full_name || 'Usuário Anônimo'}
                      {isCurrentUser && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Você
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate hidden sm:block">
                      {entry.user_id}
                    </p>
                  </div>
                  
                  <div className="flex-shrink-0 text-right" role="gridcell">
                    <p className="font-semibold text-primary text-sm sm:text-base">
                      {entry.points.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                </div>
              )
            })
          )}
          
          {userRank && userRank > showTop && (
            <>
              <div className="border-t my-2" />
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex-shrink-0 w-8 flex items-center justify-center">
                  <span className="text-muted-foreground font-semibold text-sm">
                    #{userRank}
                  </span>
                </div>
                
                <Avatar className="h-10 w-10">
                  <AvatarFallback>V</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-primary font-semibold">
                    Sua posição
                  </p>
                </div>
                
                <div className="flex-shrink-0 text-right">
                  <p className="font-semibold text-primary">
                    {entries[userRank - 1]?.points.toLocaleString('pt-BR') || '0'}
                  </p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

