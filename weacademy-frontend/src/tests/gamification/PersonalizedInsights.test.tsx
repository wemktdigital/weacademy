import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonalizedInsights } from '@/components/gamification/PersonalizedInsights'

describe('PersonalizedInsights', () => {
  const baseStats = {
    total_xp: 1000,
    current_level: 5,
    level_xp: 450,
    next_level_xp: 500,
    current_streak: 3,
    longest_streak: 5,
    achievements_unlocked: 5,
    achievements_total: 20,
  }

  it('should render insight about next level when close', () => {
    const stats = {
      ...baseStats,
      level_xp: 350, // 70% do próximo nível
      next_level_xp: 500,
    }

    render(<PersonalizedInsights stats={stats} />)
    
    expect(screen.getByText(/Quase lá!/i)).toBeInTheDocument()
  })

  it('should render streak insight when streak is active', () => {
    const stats = {
      ...baseStats,
      current_streak: 5,
    }

    render(<PersonalizedInsights stats={stats} />)
    
    expect(screen.getByText(/Mantenha a sequência!/i)).toBeInTheDocument()
  })

  it('should render achievement progress insight', () => {
    const stats = {
      ...baseStats,
      achievements_unlocked: 8,
      achievements_total: 20,
    }

    render(<PersonalizedInsights stats={stats} />)
    
    expect(screen.getByText(/Continue conquistando!/i)).toBeInTheDocument()
  })

  it('should render welcome message for new users', () => {
    const stats = {
      ...baseStats,
      total_xp: 50,
      current_streak: 0,
    }

    render(<PersonalizedInsights stats={stats} />)
    
    expect(screen.getByText(/Bem-vindo!/i)).toBeInTheDocument()
  })

  it('should not render when no insights match', () => {
    const stats = {
      ...baseStats,
      total_xp: 150, // >= 100, então não aciona "Bem-vindo!" (que requer < 100)
      level_xp: 10,
      next_level_xp: 500, // 2% - não perto de 70% (não aciona "Quase lá!")
      current_streak: 0, // Sem streak (não aciona insights de streak)
      longest_streak: 0,
      achievements_unlocked: 0,
      achievements_total: 20, // 0% - sem achievements (não aciona insights de achievements)
      // Condições que NÃO são acionadas:
      // - total_xp >= 100 (não aciona "Bem-vindo!")
      // - progressToNextLevel = 10/500 = 2% < 70% (não aciona "Quase lá!")
      // - current_streak = 0 (não aciona insights de streak)
      // - achievementProgress = 0/20 = 0% (não aciona insights de achievements)
    }

    const { container } = render(<PersonalizedInsights stats={stats} />)
    
    // Quando não há insights, o componente retorna null (linha 178: if (topInsights.length === 0) return null)
    // Verificar que não há conteúdo renderizado
    // O componente retorna null diretamente, então não deve haver nenhum elemento
    expect(container.firstChild).toBeNull()
  })

  it('should render action buttons for insights with actions', () => {
    const stats = {
      ...baseStats,
      level_xp: 350,
      next_level_xp: 500,
    }

    render(<PersonalizedInsights stats={stats} />)
    
    const insightCard = screen.getByText(/Quase lá!/i).closest('a')
    expect(insightCard).toBeInTheDocument()
  })
})

