'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Save } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Module {
  id?: string
  title: string
  description: string
  order_index: number
  lessons: Lesson[]
}

interface Lesson {
  id?: string
  title: string
  description: string
  type: 'video' | 'text' | 'quiz' | 'pdf'
  video_url?: string
  video_provider?: 'youtube' | 'vimeo'
  content?: string
  duration_minutes: number
  is_preview: boolean
  is_free: boolean
  order_index: number
}

interface CourseFormProps {
  courseData?: any
  categories: any[]
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}

export function CourseForm({ courseData, categories, onSubmit, onCancel }: CourseFormProps) {
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    title: courseData?.title || '',
    slug: courseData?.slug || '',
    description: courseData?.description || '',
    short_description: courseData?.short_description || '',
    price: courseData?.price || 0,
    is_free: courseData?.is_free || false,
    level: courseData?.level || 'beginner',
    category_id: courseData?.category_id || '',
    duration_hours: courseData?.duration_hours || 0,
    status: courseData?.status || 'draft',
    thumbnail_url: courseData?.thumbnail_url || '',
    video_url: courseData?.video_url || '',
    video_provider: courseData?.video_provider || 'youtube',
    modules: courseData?.modules || [],
  })

  const handleAddModule = () => {
    setFormData(prev => ({
      ...prev,
      modules: [
        ...prev.modules,
        {
          title: '',
          description: '',
          order_index: prev.modules.length,
          lessons: [],
        },
      ],
    }))
  }

  const handleUpdateModule = (index: number, data: Partial<Module>) => {
    const updatedModules = [...formData.modules]
    updatedModules[index] = { ...updatedModules[index], ...data }
    setFormData(prev => ({ ...prev, modules: updatedModules }))
  }

  const handleDeleteModule = (index: number) => {
    if (!confirm('Tem certeza que deseja deletar este módulo?')) return
    const updatedModules = formData.modules.filter((_, i) => i !== index)
    setFormData(prev => ({ ...prev, modules: updatedModules }))
  }

  const handleAddLesson = (moduleIndex: number) => {
    const updatedModules = [...formData.modules]
    const module = updatedModules[moduleIndex]
    module.lessons.push({
      title: '',
      description: '',
      type: 'video',
      duration_minutes: 0,
      is_preview: false,
      is_free: false,
      order_index: module.lessons.length,
    })
    setFormData(prev => ({ ...prev, modules: updatedModules }))
  }

  const handleUpdateLesson = (moduleIndex: number, lessonIndex: number, data: Partial<Lesson>) => {
    const updatedModules = [...formData.modules]
    const lesson = updatedModules[moduleIndex].lessons[lessonIndex]
    updatedModules[moduleIndex].lessons[lessonIndex] = { ...lesson, ...data }
    setFormData(prev => ({ ...prev, modules: updatedModules }))
  }

  const handleDeleteLesson = (moduleIndex: number, lessonIndex: number) => {
    const updatedModules = [...formData.modules]
    updatedModules[moduleIndex].lessons = updatedModules[moduleIndex].lessons.filter((_, i) => i !== lessonIndex)
    setFormData(prev => ({ ...prev, modules: updatedModules }))
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      await onSubmit(formData)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informações Básicas */}
      <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Preencha as informações básicas do curso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Curso *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setFormData(prev => ({
                      ...prev,
                      title,
                      slug: generateSlug(title),
                    }))
                  }}
                  placeholder="Ex: Introdução à Medicina"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="ex: introducao-medicina"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description">Descrição Curta</Label>
                <Input
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
                  placeholder="Uma descrição breve do curso..."
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.short_description.length}/200 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição Completa</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição detalhada do curso..."
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Nível</Label>
                  <Select
                    value={formData.level}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Iniciante</SelectItem>
                      <SelectItem value="intermediate">Intermediário</SelectItem>
                      <SelectItem value="advanced">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                        </div>
        </CardContent>
      </Card>
      </div>

      {/* Módulos e Lições */}
      <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Módulos e Lições</CardTitle>
                  <CardDescription>Organize o conteúdo do curso</CardDescription>
                </div>
                <Button type="button" onClick={handleAddModule} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Módulo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.modules.map((module, moduleIndex) => (
                <Card key={moduleIndex} className="border-l-4 border-l-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Módulo {moduleIndex + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteModule(moduleIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Título do Módulo</Label>
                      <Input
                        value={module.title}
                        onChange={(e) => handleUpdateModule(moduleIndex, { title: e.target.value })}
                        placeholder="Ex: Fundamentos"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={module.description}
                        onChange={(e) => handleUpdateModule(moduleIndex, { description: e.target.value })}
                        placeholder="Descrição do módulo..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Lições</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddLesson(moduleIndex)}
                        >
                          <Plus className="mr-2 h-3 w-3" />
                          Adicionar Lição
                        </Button>
                      </div>

                      {module.lessons.map((lesson, lessonIndex) => (
                        <Card key={lessonIndex} className="mb-2">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">Lição {lessonIndex + 1}</CardTitle>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteLesson(moduleIndex, lessonIndex)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Input
                              placeholder="Título da lição"
                              value={lesson.title}
                              onChange={(e) => handleUpdateLesson(moduleIndex, lessonIndex, { title: e.target.value })}
                            />
                            <Select
                              value={lesson.type}
                              onValueChange={(value: any) => handleUpdateLesson(moduleIndex, lessonIndex, { type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="video">Vídeo</SelectItem>
                                <SelectItem value="text">Texto</SelectItem>
                                <SelectItem value="quiz">Quiz</SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="Duração (min)"
                                value={lesson.duration_minutes}
                                onChange={(e) => handleUpdateLesson(moduleIndex, lessonIndex, { duration_minutes: parseInt(e.target.value) || 0 })}
                                className="flex-1"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={lesson.is_preview}
                                  onChange={(e) => handleUpdateLesson(moduleIndex, lessonIndex, { is_preview: e.target.checked })}
                                />
                                <span className="text-xs">Preview</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
      </div>

      {/* Configurações */}
      <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
              <CardDescription>Preço, status e outras configurações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is_free">Curso Grátis</Label>
                <Switch
                  id="is_free"
                  checked={formData.is_free}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_free: checked }))}
                />
              </div>

              {!formData.is_free && (
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="duration_hours">Duração Total (horas)</Label>
                <Input
                  id="duration_hours"
                  type="number"
                  value={formData.duration_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Botão de salvar */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? 'Salvando...' : 'Salvar Curso'}
        </Button>
      </div>
    </form>
  )
}
