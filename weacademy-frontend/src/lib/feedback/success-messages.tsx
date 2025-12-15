'use client'

import React from 'react'
import { CheckCircle2, Star, Trophy, Sparkles, Award } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Utilitários para criar mensagens de sucesso claras e específicas
 */

export interface SuccessContext {
  action: string // Ação executada (ex: "curso criado", "mensagem enviada")
  entity?: string // Entidade afetada (ex: "curso", "mensagem")
  duration?: number // Duração em ms (padrão: 5000)
  showIcon?: boolean // Mostrar ícone (padrão: true)
  variant?: 'default' | 'achievement' | 'important' // Variante visual
}

export interface SuccessMessage {
  title: string
  description?: string
  icon?: ReactNode
  duration: number
  variant: 'default' | 'success' | 'achievement'
}

// Funções auxiliares para criar ícones usando React.createElement para evitar problemas de parsing
const createStarIcon = () => React.createElement(Star, { className: "h-5 w-5 text-yellow-500" })
const createCheckIcon = () => React.createElement(CheckCircle2, { className: "h-5 w-5 text-green-500" })
const createSparklesIcon = () => React.createElement(Sparkles, { className: "h-5 w-5 text-primary" })
const createTrophyIcon = () => React.createElement(Trophy, { className: "h-5 w-5 text-yellow-500" })
const createAwardIcon = () => React.createElement(Award, { className: "h-5 w-5 text-primary" })

const SUCCESS_MESSAGES: Record<string, { title: string; icon?: () => ReactNode; variant?: 'default' | 'success' | 'achievement' }> = {
  'curso criado': {
    title: 'Curso criado com sucesso!',
    icon: createStarIcon,
    variant: 'success',
  },
  'curso atualizado': {
    title: 'Curso atualizado com sucesso!',
    icon: createCheckIcon,
    variant: 'success',
  },
  'curso deletado': {
    title: 'Curso removido com sucesso',
    icon: createCheckIcon,
    variant: 'success',
  },
  'mensagem enviada': {
    title: 'Mensagem enviada!',
    icon: createSparklesIcon,
    variant: 'success',
  },
  'perfil atualizado': {
    title: 'Perfil atualizado com sucesso!',
    icon: createCheckIcon,
    variant: 'success',
  },
  'configurações salvas': {
    title: 'Configurações salvas!',
    icon: createCheckIcon,
    variant: 'success',
  },
  'arquivo enviado': {
    title: 'Arquivo enviado com sucesso!',
    icon: createCheckIcon,
    variant: 'success',
  },
  'conquista desbloqueada': {
    title: 'Conquista Desbloqueada!',
    icon: createTrophyIcon,
    variant: 'achievement',
  },
  'nível alcançado': {
    title: 'Level Up!',
    icon: createAwardIcon,
    variant: 'achievement',
  },
}

/**
 * Cria mensagem de sucesso específica baseada no contexto
 */
export function createSuccessMessage(context: SuccessContext): SuccessMessage {
  const actionKey = context.action.toLowerCase()
  const defaultConfig = SUCCESS_MESSAGES[actionKey] || {
    title: `${context.action.charAt(0).toUpperCase() + context.action.slice(1)} com sucesso!`,
    icon: createCheckIcon,
    variant: 'success' as const,
  }

  return {
    title: defaultConfig.title,
    description: context.entity 
      ? `${context.entity.charAt(0).toUpperCase() + context.entity.slice(1)} processado com sucesso.`
      : undefined,
    icon: context.showIcon !== false && defaultConfig.icon ? defaultConfig.icon() : undefined,
    duration: context.duration || (defaultConfig.variant === 'achievement' ? 6000 : 5000),
    variant: defaultConfig.variant || 'success',
  }
}

/**
 * Exibe mensagem de sucesso usando toast
 */
export function showSuccessMessage(
  context: SuccessContext,
  toast?: any
) {
  if (!toast) {
    console.warn('Toast function not provided')
    return
  }

  const successMessage = createSuccessMessage(context)

  toast({
    title: successMessage.title,
    description: successMessage.description,
    icon: successMessage.icon,
    duration: successMessage.duration,
    className: successMessage.variant === 'achievement' 
      ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' 
      : undefined,
  })
}

