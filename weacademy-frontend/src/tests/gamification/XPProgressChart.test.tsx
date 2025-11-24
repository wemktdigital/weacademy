import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { XPProgressChart } from '@/components/gamification/XPProgressChart'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
  }),
}))

// Mock fetch
global.fetch = vi.fn()

// Mock recharts para evitar problemas com SVG/Canvas
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}))

describe('XPProgressChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    ;(global.fetch as any).mockImplementation(() => new Promise(() => {}))
    
    render(<XPProgressChart />)
    
    expect(screen.getByText(/Evolução de XP/i)).toBeInTheDocument()
  })

  it('should render chart when data is loaded', async () => {
    const mockData = {
      history: [
        { date: '01/01', xp: 100, cumulativeXp: 100 },
        { date: '02/01', xp: 150, cumulativeXp: 250 },
      ],
      stats: {
        totalXP: 250,
        avgDailyXP: 125,
        maxDailyXP: 150,
        currentStreak: 2,
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    render(<XPProgressChart />)

    await waitFor(() => {
      expect(screen.getByText(/250 XP total/i)).toBeInTheDocument()
    })
  })

  it('should show empty state when no data', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ history: [], stats: null }),
    })

    render(<XPProgressChart />)

    await waitFor(() => {
      expect(screen.getByText(/Nenhum dado de XP encontrado/i)).toBeInTheDocument()
    })
  })

  it('should display statistics correctly', async () => {
    const mockData = {
      history: [{ date: '01/01', xp: 100, cumulativeXp: 100 }],
      stats: {
        totalXP: 100,
        avgDailyXP: 100,
        maxDailyXP: 100,
        currentStreak: 1,
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    render(<XPProgressChart />)

    await waitFor(() => {
      // Verificar que as estatísticas são renderizadas
      // Usar getAllByText para encontrar todos os "100" e verificar que pelo menos um existe
      const elements = screen.getAllByText(/100/)
      expect(elements.length).toBeGreaterThan(0)
    })
  })
})

