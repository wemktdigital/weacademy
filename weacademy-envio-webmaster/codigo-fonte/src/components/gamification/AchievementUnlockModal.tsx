'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, X } from 'lucide-react'
import { AchievementBadge } from './AchievementBadge'
import { useConfetti } from '@/hooks/useConfetti'
import { useAchievementSound } from '@/hooks/useAchievementSound'
import { cn } from '@/lib/utils'

export interface AchievementUnlockModalProps {
  open: boolean
  achievement: {
    icon: string
    name: string
    description?: string
    rarity?: 'common' | 'rare' | 'epic' | 'legendary'
    unlockedAt?: string | null
  }
  onClose: () => void
}

const RARITY_COLORS = {
  common: 'from-gray-400/20 to-gray-500/20 border-gray-400/50',
  rare: 'from-blue-400/20 to-blue-500/20 border-blue-400/50',
  epic: 'from-purple-400/20 to-purple-500/20 border-purple-400/50',
  legendary: 'from-yellow-400/20 via-orange-400/20 to-yellow-500/20 border-yellow-400/50',
}

const RARITY_LABELS = {
  common: 'Comum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
}

export function AchievementUnlockModal({ open, achievement, onClose }: AchievementUnlockModalProps) {
  const { fire } = useConfetti()
  const { playSound } = useAchievementSound()
  const [showContent, setShowContent] = useState(false)
  const rarity = achievement.rarity || 'common'
  const isRareOrAbove = rarity !== 'common'

  useEffect(() => {
    if (open && isRareOrAbove) {
      // Disparar confetti baseado na raridade
      const confettiType = rarity === 'legendary' ? 'legendary' : rarity === 'epic' ? 'epic' : 'rare'
      
      setTimeout(() => {
        fire({ type: confettiType })
        playSound(confettiType)
      }, 300)

      // Mostrar conteúdo após animação inicial
      setTimeout(() => {
        setShowContent(true)
      }, 500)
    } else if (open) {
      // Para achievements comuns, apenas tocar som
      setTimeout(() => {
        playSound('achievement')
      }, 300)
      setShowContent(true)
    } else {
      setShowContent(false)
    }
  }, [open, isRareOrAbove, rarity, fire, playSound])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative">
          {/* Background animado baseado na raridade */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br rounded-2xl blur-3xl animate-pulse',
            RARITY_COLORS[rarity]
          )} />
          
          {/* Conteúdo */}
          <div className={cn(
            'relative bg-background/95 backdrop-blur-sm rounded-2xl border-2 p-8 shadow-2xl',
            RARITY_COLORS[rarity]
          )}>
            {/* Botão de fechar */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>

            {/* Badge do achievement */}
            <div className="flex flex-col items-center space-y-6">
              <div className={cn(
                'transition-all duration-500',
                showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              )}>
                <AchievementBadge
                  icon={achievement.icon}
                  name={achievement.name}
                  description={achievement.description}
                  rarity={rarity}
                  unlocked={true}
                  size="lg"
                  showTooltip={false}
                  className={cn(
                    rarity === 'legendary' && 'motion-safe:animate-pulse',
                    rarity === 'epic' && 'motion-safe:animate-pulse',
                  )}
                />
              </div>

              {/* Informações */}
              <div className={cn(
                'text-center space-y-3 transition-all duration-500 delay-200',
                showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              )}>
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-2xl font-bold">Conquista Desbloqueada!</h2>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{achievement.name}</h3>
                  {achievement.description && (
                    <p className="text-muted-foreground">{achievement.description}</p>
                  )}
                </div>

                <Badge
                  variant={rarity === 'legendary' ? 'default' : 'secondary'}
                  className={cn(
                    'text-sm px-3 py-1',
                    rarity === 'legendary' && 'bg-yellow-500 text-yellow-950',
                  )}
                >
                  {RARITY_LABELS[rarity]}
                </Badge>
              </div>

              {/* Botão de fechar */}
              <Button
                onClick={onClose}
                className={cn(
                  'mt-4 transition-all duration-500 delay-300',
                  showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}
              >
                Ótimo!
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

