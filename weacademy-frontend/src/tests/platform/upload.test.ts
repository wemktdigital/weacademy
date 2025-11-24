import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabaseServer')
vi.mock('@/lib/supabase')

// Mock supabaseServer
vi.mock('@/lib/supabaseServer', () => {
  return {
    supabaseServer: vi.fn().mockImplementation(async () => {
      return mockSupabase.getClient()
    }),
  }
})

// Mock NextRequest
const createMockRequest = (options?: {
  method?: string
  headers?: Record<string, string>
  formData?: FormData
}) => {
  const headers = new Headers(options?.headers || {})
  
  return {
    method: options?.method || 'POST',
    headers,
    formData: vi.fn().mockResolvedValue(options?.formData || new FormData()),
  } as unknown as NextRequest
}

describe('Upload API', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('POST /api/upload', () => {
    it('should return 401 if not authenticated', async () => {
      const { supabaseServer } = await import('@/lib/supabaseServer')
      const supabaseClient = await supabaseServer()
      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

      const request = createMockRequest({
        method: 'POST',
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - user role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })

    it('should validate that file is provided', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - admin role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const formData = new FormData()
      // No file appended

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Nenhum arquivo enviado')
    })

    it('should validate file type', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - admin role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.exe', { type: 'application/x-msdownload' }))

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Tipo de arquivo não permitido')
    })

    it('should validate file size (max 5MB)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - admin role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      // Criar arquivo maior que 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024) // 6 MB
      const mockFile = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(largeBuffer.buffer)

      const formData = new FormData()
      formData.append('file', mockFile)

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Arquivo muito grande')
    })

    it('should upload file successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - admin role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const fileBuffer = Buffer.from('fake image data')
      const mockFile = new File([fileBuffer], 'test.jpg', { type: 'image/jpeg' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(fileBuffer.buffer)

      const formData = new FormData()
      formData.append('file', mockFile)

      const mockUploadResult = {
        path: '1234567890-abc123.jpg',
      }
      const mockPublicUrl = 'https://supabase.co/storage/v1/object/public/course-thumbnails/1234567890-abc123.jpg'

      // Mock Supabase Storage
      mockSupabase.serviceRoleClient.storage = {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: mockUploadResult,
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockPublicUrl },
          }),
        }),
      } as any

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.url).toBe(mockPublicUrl)
      expect(data.path).toBe(mockUploadResult.path)
    })

    it('should allow instructor to upload', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'instructor@test.com')
      const mockProfile = createMockProfile('instructor')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - instructor role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const fileBuffer = Buffer.from('fake image data')
      const mockFile = new File([fileBuffer], 'test.jpg', { type: 'image/jpeg' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(fileBuffer.buffer)

      const formData = new FormData()
      formData.append('file', mockFile)

      const mockUploadResult = {
        path: '1234567890-abc123.jpg',
      }
      const mockPublicUrl = 'https://supabase.co/storage/v1/object/public/course-thumbnails/1234567890-abc123.jpg'

      // Mock Supabase Storage
      mockSupabase.serviceRoleClient.storage = {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: mockUploadResult,
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockPublicUrl },
          }),
        }),
      } as any

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        formData,
      })

      const { POST } = await import('@/app/api/upload/route')
      const response = await POST(request)

      // Should not return 403
      expect(response.status).not.toBe(403)
    })
  })
})

