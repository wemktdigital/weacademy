'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  
  const { user, loading: authLoading, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    price: 0,
    is_free: false,
  })

  useEffect(() => {
    if (authLoading) return
    if (!user || !isAdmin) {
      router.push('/access-denied')
    }
  }, [user, isAdmin, router, authLoading])

  useEffect(() => {
    loadCourse()
  }, [courseId, user, isAdmin])

  const loadCourse = async () => {
    if (!user || !isAdmin) return
    
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/courses/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar curso')
      }

      setFormData({
        title: result.course.title || '',
        slug: result.course.slug || '',
        description: result.course.description || '',
        price: result.course.price || 0,
        is_free: result.course.is_free || false,
      })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
      router.push('/admin/courses')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMsg = result.details 
          ? `${result.error}: ${result.details}` 
          : result.error || 'Erro ao atualizar curso'

        if (result.details && typeof result.details === 'string') {
          const newErrors: Record<string, string> = {}
          result.details.split(',').forEach((pair: string) => {
            const [rawKey, ...rest] = pair.split(':')
            const key = rawKey?.trim()
            const msg = rest.join(':').trim()
            if (key && msg) newErrors[key] = msg
          })
          if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
          }
        }

        throw new Error(errorMsg)
      }

      toast({
        title: 'Sucesso',
        description: 'Curso atualizado com sucesso!',
      })

      router.push('/admin/courses')
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/courses')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Curso</h1>
            <p className="text-muted-foreground">Edite as informações do curso</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value })
                if (errors.title) setErrors({ ...errors, title: '' })
              }}
              placeholder="Título do curso"
              required
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => {
                setFormData({ ...formData, slug: e.target.value })
                if (errors.slug) setErrors({ ...errors, slug: '' })
              }}
              placeholder="url-amigavel-do-curso"
            />
            <p className="text-sm text-muted-foreground">
              URL amigável do curso
            </p>
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                if (errors.description) setErrors({ ...errors, description: '' })
              }}
              placeholder="Descrição do curso"
              rows={5}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="flex gap-6">
            <div className="space-y-2 flex-1">
              <Label htmlFor="price">Preço</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div className="flex items-center gap-2 pt-8">
              <input
                type="checkbox"
                id="is_free"
                checked={formData.is_free}
                onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_free">Curso gratuito</Label>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/courses')}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

