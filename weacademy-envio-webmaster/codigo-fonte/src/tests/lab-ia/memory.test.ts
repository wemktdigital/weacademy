import { describe, it, expect, vi, beforeEach } from 'vitest'
import { remember, recallProfile, forget } from '@/modules/laboratorio-ia/services/memory'
import { createClient } from '@/lib/supabase'

describe('Lab IA - Memory System', () => {
  const mockFrom = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    
    // Mock completo do Supabase com encadeamento
    const createChainableMock = () => {
      const chain = vi.fn().mockReturnThis()
      chain.select = vi.fn().mockReturnThis()
      chain.insert = vi.fn().mockReturnThis()
      chain.update = vi.fn().mockReturnThis()
      chain.delete = vi.fn().mockReturnThis()
      chain.upsert = vi.fn().mockReturnThis()
      chain.eq = vi.fn().mockReturnThis()
      chain.is = vi.fn().mockReturnThis()
      chain.order = vi.fn().mockReturnThis()
      chain.limit = vi.fn().mockReturnThis()
      return chain
    }
    
    mockFrom.mockReturnValue(createChainableMock())
    
    vi.mocked(createClient).mockReturnValue({
      from: mockFrom,
    } as any)
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

    // Configurar mock para retornar dados
    const chain1 = vi.fn().mockReturnThis()
    chain1.select = vi.fn().mockReturnThis()
    chain1.eq = vi.fn().mockReturnThis()
    chain1.is = vi.fn().mockReturnThis()
    chain1.order = vi.fn().mockReturnThis()
    chain1.limit = vi.fn().mockResolvedValue({ data: mockMemories, error: null })
    
    const chain2 = vi.fn().mockReturnThis()
    chain2.select = vi.fn().mockReturnThis()
    chain2.eq = vi.fn().mockReturnThis()
    chain2.order = vi.fn().mockReturnThis()
    chain2.limit = vi.fn().mockResolvedValue({ data: [], error: null })
    
    mockFrom
      .mockReturnValueOnce(chain1)  // Global memories
      .mockReturnValueOnce(chain2)  // Agent memories

    const profile = await recallProfile({
      userId: 'user-123',
      agentId: 'agent-123',
    })

    expect(profile.global).toHaveLength(1)
    expect(profile.global[0].key).toBe('especialidade_medica')
    expect(profile.global[0].value).toBe('Cardiologia')
  })

  it('should delete a memory using forget()', async () => {
    // Configurar mock para delete
    const chain = vi.fn().mockReturnThis()
    chain.delete = vi.fn().mockReturnThis()
    chain.eq = vi.fn().mockReturnThis()
    
    mockFrom.mockReturnValueOnce(chain)

    await forget({
      userId: 'user-123',
      agentId: null,
      key: 'especialidade_medica',
    })

    expect(mockFrom).toHaveBeenCalledWith('lab_agent_memory')
  })

  it('should handle PHI detection', async () => {
    const { containsPHI } = await import('@/modules/laboratorio-ia/services/summary')

    expect(containsPHI('CPF: 123.456.789-00')).toBe(true)
    expect(containsPHI('Telefone: 9999-8888')).toBe(true)
    expect(containsPHI('Data de nascimento: 01/01/1990')).toBe(true)
    expect(containsPHI('Sr. João Silva')).toBe(true) // Padrão correto com Sr.
    expect(containsPHI('Email: teste@example.com')).toBe(true)
    expect(containsPHI('Mensagem normal')).toBe(false)
  })

  it('should sanitize PHI', async () => {
    const { sanitizePHI } = await import('@/modules/laboratorio-ia/services/summary')

    expect(sanitizePHI('CPF: 123.456.789-00')).toBe('CPF: [CPF]')
    expect(sanitizePHI('Telefone: 9999-8888')).toBe('Telefone: [TELEFONE]')
    expect(sanitizePHI('Data: 01/01/1990')).toBe('Data: [DATA]')
  })
})
