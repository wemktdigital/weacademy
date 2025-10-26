import { describe, it, expect, vi, beforeEach } from 'vitest'
import { remember, recallProfile, forget } from '@/modules/laboratorio-ia/services/memory'
import { createClient } from '@/lib/supabase'

describe('Lab IA - Memory System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should save a memory using remember()', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    await remember({
      userId: 'user-123',
      agentId: null,
      key: 'especialidade_medica',
      value: 'Cardiologia',
      importance: 5,
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('lab_agent_memory')
  })

  it('should recall memories using recallProfile()', async () => {
    const mockMemories = [
      { key: 'especialidade_medica', value: 'Cardiologia', importance: 5 },
    ]

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockMemories,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })),
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    const profile = await recallProfile({
      userId: 'user-123',
      agentId: 'agent-123',
    })

    expect(profile.global).toHaveLength(1)
    expect(profile.global[0].key).toBe('especialidade_medica')
    expect(profile.global[0].value).toBe('Cardiologia')
  })

  it('should delete a memory using forget()', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      })),
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    await forget({
      userId: 'user-123',
      agentId: null,
      key: 'especialidade_medica',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('lab_agent_memory')
  })

  it('should handle PHI detection', async () => {
    const { containsPHI } = await import('@/modules/laboratorio-ia/services/summary')

    expect(containsPHI('CPF: 123.456.789-00')).toBe(true)
    expect(containsPHI('Telefone: 9999-8888')).toBe(true)
    expect(containsPHI('Data de nascimento: 01/01/1990')).toBe(true)
    expect(containsPHI('Paciente: João Silva')).toBe(true)
    expect(containsPHI('Mensagem normal')).toBe(false)
  })

  it('should sanitize PHI', async () => {
    const { sanitizePHI } = await import('@/modules/laboratorio-ia/services/summary')

    expect(sanitizePHI('CPF: 123.456.789-00')).toBe('CPF: [CPF]')
    expect(sanitizePHI('Telefone: 9999-8888')).toBe('Telefone: [TELEFONE]')
    expect(sanitizePHI('Data: 01/01/1990')).toBe('Data: [DATA]')
  })
})
