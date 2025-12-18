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
  CardHeader,
} from '@/components/ui/card'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
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

  const moveModule = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === modules.length - 1)) return

    const newModules = [...modules]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    const temp = newModules[index]
    newModules[index] = newModules[targetIndex]
    newModules[targetIndex] = temp

    // Update order_index
    newModules.forEach((m, i) => m.order_index = i)

    onChange(newModules)

    // Adjust expanded state
    const newExpanded = new Set<number>()
    expandedModules.forEach(i => {
      if (i === index) newExpanded.add(targetIndex)
      else if (i === targetIndex) newExpanded.add(index)
      else newExpanded.add(i)
    })
    setExpandedModules(newExpanded)
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

  const moveLesson = (moduleIndex: number, lessonIndex: number, direction: 'up' | 'down') => {
    const lessons = [...modules[moduleIndex].lessons]
    if ((direction === 'up' && lessonIndex === 0) || (direction === 'down' && lessonIndex === lessons.length - 1)) return

    const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1

    const temp = lessons[lessonIndex]
    lessons[lessonIndex] = lessons[targetIndex]
    lessons[targetIndex] = temp

    // Update order_index
    lessons.forEach((l, i) => l.order_index = i)

    const newModules = [...modules]
    newModules[moduleIndex] = { ...newModules[moduleIndex], lessons }
    onChange(newModules)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Módulos e Lições</h3>
          <p className="text-sm text-muted-foreground">
            Organize o conteúdo do curso. Use as setas para reordenar.
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
            <Card key={moduleIndex} className="transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 pt-1">
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={moduleIndex === 0}
                        onClick={() => moveModule(moduleIndex, 'up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={moduleIndex === modules.length - 1}
                        onClick={() => moveModule(moduleIndex, 'down')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Módulo {moduleIndex + 1}</Badge>
                        <span className="text-sm text-muted-foreground">({module.lessons.length} lições)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeModule(moduleIndex)}
                        className="text-destructive hover:text-destructive/90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Input
                      placeholder="Título do módulo"
                      value={module.title}
                      onChange={(e) => updateModule(moduleIndex, { title: e.target.value })}
                    />
                    <Textarea
                      placeholder="Descrição do módulo (opcional)"
                      value={module.description}
                      onChange={(e) => updateModule(moduleIndex, { description: e.target.value })}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3 pl-10 border-l-2 border-muted ml-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Lições</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addLesson(moduleIndex)}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Adicionar Lição
                    </Button>
                  </div>

                  {module.lessons.map((lesson, lessonIndex) => (
                    <Card key={lessonIndex} className="bg-muted/30 relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={lessonIndex === 0}
                          onClick={() => moveLesson(moduleIndex, lessonIndex, 'up')}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={lessonIndex === module.lessons.length - 1}
                          onClick={() => moveLesson(moduleIndex, lessonIndex, 'down')}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>

                      <CardContent className="pt-4 pl-10 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <Input
                              placeholder="Nome da lição"
                              value={lesson.title}
                              onChange={(e) => updateLesson(moduleIndex, lessonIndex, { title: e.target.value })}
                              className="font-medium"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <Select
                                value={lesson.type}
                                onValueChange={(value: any) => updateLesson(moduleIndex, lessonIndex, { type: value })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="video">Vídeo</SelectItem>
                                  <SelectItem value="text">Texto</SelectItem>
                                  <SelectItem value="pdf">PDF</SelectItem>
                                  <SelectItem value="quiz">Quiz</SelectItem>
                                  <SelectItem value="audio">Áudio</SelectItem>
                                </SelectContent>
                              </Select>

                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="Min"
                                  value={lesson.duration_minutes}
                                  onChange={(e) => updateLesson(moduleIndex, lessonIndex, { duration_minutes: Number(e.target.value) })}
                                  className="w-20"
                                />
                                <span className="text-xs text-muted-foreground">min</span>
                              </div>
                            </div>

                            {lesson.type === 'video' && (
                              <div className="grid grid-cols-3 gap-3">
                                <Select
                                  value={lesson.video_provider || 'youtube'}
                                  onValueChange={(value: 'youtube' | 'vimeo') => updateLesson(moduleIndex, lessonIndex, { video_provider: value })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="vimeo">Vimeo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="URL do vídeo"
                                  value={lesson.video_url || ''}
                                  onChange={(e) => updateLesson(moduleIndex, lessonIndex, { video_url: e.target.value })}
                                  className="col-span-2"
                                />
                              </div>
                            )}

                            <div className="flex gap-4 pt-1">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={lesson.is_preview} onChange={e => updateLesson(moduleIndex, lessonIndex, { is_preview: e.target.checked })} />
                                Preview
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={lesson.is_free} onChange={e => updateLesson(moduleIndex, lessonIndex, { is_free: e.target.checked })} />
                                Grátis
                              </label>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLesson(moduleIndex, lessonIndex)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
