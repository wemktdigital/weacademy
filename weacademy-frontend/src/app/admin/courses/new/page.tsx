'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { ImageUpload } from '@/components/admin/image-upload'
import { ModuleManager } from '@/components/admin/module-manager'

export default function NewCoursePage() {
  const router = useRouter()
  const { user, loading: authLoading, isAdmin } = useAuth()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [modules, setModules] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    price: 0,
    is_free: false,
    thumbnail_url: '',
  })

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.push('/access-denied')
    }
  }, [user, isAdmin, router, authLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Obter sessão com timeout para evitar travamento
      const getSessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao obter sessão')), 5000)
      )

      const { data: sessionData } = await Promise.race([getSessionPromise, timeoutPromise]) as any
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Você precisa estar logado para realizar esta ação')
      }

      // Enviar para API
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          slug: formData.slug || formData.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
          description: formData.description,
          price: formData.price,
          is_free: formData.is_free,
          thumbnail_url: formData.thumbnail_url,
          modules: modules,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Mostrar erro detalhado se disponível
        const errorMsg = result.details
          ? `${result.error}: ${result.details}`
          : result.error || 'Erro ao criar curso'

        // Tentar mapear detalhes para os campos
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
        description: 'Curso criado com sucesso!',
      })

      router.push('/admin/courses')
    } catch (error: any) {
      console.error('Erro ao criar curso:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao criar o curso',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
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
            <h1 className="text-3xl font-bold">Novo Curso</h1>
            <p className="text-muted-foreground">Crie um novo curso</p>
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
            <Label htmlFor="slug">Slug (opcional)</Label>
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
              Deixe em branco para gerar automaticamente
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

          <div className="space-y-2">
            <Label>Thumbnail (opcional)</Label>
            <ImageUpload
              value={formData.thumbnail_url}
              onChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
            />
          </div>

          <div className="flex gap-6">
            <div className="space-y-2 flex-1">
              <Label htmlFor="price">Preço (opcional)</Label>
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

          <ModuleManager modules={modules} onChange={setModules} />

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/courses')}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Curso'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
