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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Plus,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Lesson {
  id?: string
  title: string
  description: string
  type: 'video' | 'text' | 'pdf' | 'quiz' | 'audio'
  content?: string
  video_url?: string
  video_provider?: 'youtube' | 'vimeo'
  attachments?: string[]
  duration_minutes: number
  is_preview: boolean
  is_free: boolean
  order_index: number
}

interface Module {
  id?: string
  title: string
  description: string
  order_index: number
  lessons: Lesson[]
}

interface ModuleManagerProps {
  modules: Module[]
  onChange: (modules: Module[]) => void
}

export function ModuleManager({ modules, onChange }: ModuleManagerProps) {
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())

  const toggleModule = (index: number) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedModules(newExpanded)
  }

  const addModule = () => {
    const newModule: Module = {
      title: '',
      description: '',
      order_index: modules.length,
      lessons: [],
    }
    onChange([...modules, newModule])
    setExpandedModules(new Set([modules.length]))
  }

  const removeModule = (index: number) => {
    if (confirm('Tem certeza que deseja remover este módulo e todas suas lições?')) {
      const updated = modules.filter((_, i) => i !== index)
        .map((m, i) => ({ ...m, order_index: i }))
      onChange(updated)
    }
  }

  const updateModule = (index: number, data: Partial<Module>) => {
    const updated = [...modules]
    updated[index] = { ...updated[index], ...data }
    onChange(updated)
  }

  const addLesson = (moduleIndex: number) => {
    const updated = [...modules]
    const newLesson: Lesson = {
      title: '',
      description: '',
      type: 'video',
      duration_minutes: 0,
      is_preview: false,
      is_free: false,
      order_index: updated[moduleIndex].lessons.length,
    }
    updated[moduleIndex].lessons.push(newLesson)
    onChange(updated)
  }

  const removeLesson = (moduleIndex: number, lessonIndex: number) => {
    if (confirm('Tem certeza que deseja remover esta lição?')) {
      const updated = [...modules]
      updated[moduleIndex].lessons = updated[moduleIndex].lessons.filter((_, i) => i !== lessonIndex)
        .map((l, i) => ({ ...l, order_index: i }))
      onChange(updated)
    }
  }

  const updateLesson = (moduleIndex: number, lessonIndex: number, data: Partial<Lesson>) => {
    const updated = [...modules]
    updated[moduleIndex].lessons[lessonIndex] = {
      ...updated[moduleIndex].lessons[lessonIndex],
      ...data,
    }
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Módulos e Lições</h3>
          <p className="text-sm text-muted-foreground">
            Organize o conteúdo do curso em módulos e lições
          </p>
        </div>
        <Button type="button" onClick={addModule} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Módulo
        </Button>
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center mb-4">
              Nenhum módulo adicionado
            </p>
            <Button type="button" variant="outline" onClick={addModule}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Módulo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map((module, moduleIndex) => (
            <Card key={moduleIndex}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Módulo {moduleIndex + 1}</Badge>
                    </div>
                    <Input
                      placeholder="Título do módulo"
                      value={module.title}
                      onChange={(e) => updateModule(moduleIndex, { title: e.target.value })}
                      className="mb-2"
                    />
                    <Textarea
                      placeholder="Descrição do módulo (opcional)"
                      value={module.description}
                      onChange={(e) => updateModule(moduleIndex, { description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeModule(moduleIndex)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Lições ({module.lessons.length})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addLesson(moduleIndex)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Lição
                    </Button>
                  </div>

                  {module.lessons.map((lesson, lessonIndex) => (
                    <Card key={lessonIndex} className="bg-muted/30">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            <div>
                              <Label className="text-xs">Título da Lição</Label>
                              <Input
                                placeholder="Nome da lição"
                                value={lesson.title}
                                onChange={(e) =>
                                  updateLesson(moduleIndex, lessonIndex, { title: e.target.value })
                                }
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Tipo</Label>
                                <Select
                                  value={lesson.type}
                                  onValueChange={(value: any) =>
                                    updateLesson(moduleIndex, lessonIndex, { type: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="video">Vídeo</SelectItem>
                                    <SelectItem value="text">Texto</SelectItem>
                                    <SelectItem value="pdf">PDF</SelectItem>
                                    <SelectItem value="quiz">Quiz</SelectItem>
                                    <SelectItem value="audio">Áudio</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Duração (min)</Label>
                                <Input
                                  type="number"
                                  value={lesson.duration_minutes}
                                  onChange={(e) =>
                                    updateLesson(moduleIndex, lessonIndex, {
                                      duration_minutes: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs">Descrição (opcional)</Label>
                              <Textarea
                                placeholder="Descrição da lição"
                                value={lesson.description || ''}
                                onChange={(e) =>
                                  updateLesson(moduleIndex, lessonIndex, {
                                    description: e.target.value,
                                  })
                                }
                                rows={2}
                              />
                            </div>

                            {lesson.type === 'video' && (
                              <>
                                <div>
                                  <Label className="text-xs">Provedor de Vídeo</Label>
                                  <Select
                                    value={lesson.video_provider || 'youtube'}
                                    onValueChange={(value: 'youtube' | 'vimeo') =>
                                      updateLesson(moduleIndex, lessonIndex, {
                                        video_provider: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="youtube">YouTube</SelectItem>
                                      <SelectItem value="vimeo">Vimeo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="text-xs">URL do Vídeo</Label>
                                  <Input
                                    placeholder="https://..."
                                    value={lesson.video_url || ''}
                                    onChange={(e) =>
                                      updateLesson(moduleIndex, lessonIndex, {
                                        video_url: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </>
                            )}

                            <div className="flex gap-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`preview-${moduleIndex}-${lessonIndex}`}
                                  checked={lesson.is_preview}
                                  onChange={(e) =>
                                    updateLesson(moduleIndex, lessonIndex, {
                                      is_preview: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`preview-${moduleIndex}-${lessonIndex}`} className="text-xs cursor-pointer">
                                  Preview gratuita
                                </Label>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`free-${moduleIndex}-${lessonIndex}`}
                                  checked={lesson.is_free}
                                  onChange={(e) =>
                                    updateLesson(moduleIndex, lessonIndex, {
                                      is_free: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`free-${moduleIndex}-${lessonIndex}`} className="text-xs cursor-pointer">
                                  Gratuita
                                </Label>
                              </div>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLesson(moduleIndex, lessonIndex)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

