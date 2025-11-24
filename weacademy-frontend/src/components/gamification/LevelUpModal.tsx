'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star, Sparkles, TrendingUp } from 'lucide-react'
import { useConfetti } from '@/hooks/useConfetti'
import { useAchievementSound } from '@/hooks/useAchievementSound'
import { cn } from '@/lib/utils'

export interface LevelUpModalProps {
  open: boolean
  newLevel: number
  levelName?: string
  rewards?: {
    points?: number
    achievements?: string[]
  }
  onClose: () => void
}

export function LevelUpModal({ open, newLevel, levelName, rewards, onClose }: LevelUpModalProps) {
  const { fire } = useConfetti()
  const { playSound } = useAchievementSound()
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (open) {
      // Disparar confetti e som
      setTimeout(() => {
        fire({ type: 'level-up' })
        playSound('level-up')
      }, 300)

      // Mostrar conteúdo após animação inicial
      setTimeout(() => {
        setShowContent(true)
      }, 500)
    } else {
      setShowContent(false)
    }
  }, [open, fire, playSound])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative">
          {/* Background animado */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-primary/20 to-emerald-400/20 rounded-2xl blur-3xl animate-pulse" />
          
          {/* Conteúdo */}
          <div className="relative bg-background/95 backdrop-blur-sm rounded-2xl border-2 border-primary/50 p-8 shadow-2xl">
            {/* Badge de nível grande */}
            <div className="flex flex-col items-center space-y-6">
              {/* Ícone de estrela animado */}
              <div className={cn(
                'relative w-32 h-32 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg',
                'animate-bounce motion-safe:animate-pulse'
              )}>
                <Star className="w-16 h-16 fill-white text-white" />
                <div className="absolute inset-0 rounded-full border-4 border-yellow-300 animate-ping opacity-30" />
              </div>

              {/* Título */}
              <div className={cn(
                'text-center space-y-2 transition-all duration-500',
                showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              )}>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                  Level Up!
                </h2>
                <div className="flex items-center justify-center gap-3">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    <Star className="w-4 h-4 fill-primary text-primary mr-1" />
                    Nível {newLevel}
                  </Badge>
                  {levelName && (
                    <span className="text-muted-foreground font-medium">{levelName}</span>
                  )}
                </div>
              </div>

              {/* Recompensas */}
              {rewards && (rewards.points || rewards.achievements?.length) && (
                <div className={cn(
                  'w-full space-y-3 transition-all duration-500 delay-200',
                  showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}>
                  {rewards.points && (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-primary">
                        +{rewards.points.toLocaleString('pt-BR')} XP
                      </span>
                    </div>
                  )}
                  
                  {rewards.achievements && rewards.achievements.length > 0 && (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm text-emerald-600 dark:text-emerald-400">
                        {rewards.achievements.length} conquista{rewards.achievements.length > 1 ? 's' : ''} desbloqueada{rewards.achievements.length > 1 ? 's' : ''}!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de fechar */}
              <Button
                onClick={onClose}
                className={cn(
                  'mt-4 transition-all duration-500 delay-300',
                  showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}
              >
                Continuar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

