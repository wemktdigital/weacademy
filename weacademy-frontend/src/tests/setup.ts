import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock do Next.js
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock do Supabase
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))
