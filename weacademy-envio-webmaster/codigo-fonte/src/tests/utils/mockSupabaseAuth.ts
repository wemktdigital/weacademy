import { vi } from 'vitest'

export function mockSupabaseAuth(serverFn: ReturnType<typeof vi.fn>, user: any | null) {
  const getUserMock = vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'not-authenticated' } })
  serverFn.mockReturnValue({
    auth: {
      getUser: getUserMock,
    },
  } as any)
  return getUserMock
}
