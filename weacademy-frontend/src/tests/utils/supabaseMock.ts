import { vi } from 'vitest'

export function createSupabaseClientMock() {
  const fromMock = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }))

  return {
    from: fromMock,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}
