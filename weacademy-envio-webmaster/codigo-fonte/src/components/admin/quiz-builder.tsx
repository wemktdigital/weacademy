'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Option {
  id: string
  option_text: string
  is_correct: boolean
}

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'single_answer'
  points: number
  correct_answer?: string | null
  options: Option[]
}

interface QuizData {
  title: string
  description: string
  passing_score: number
  time_limit_minutes?: number
  questions: Question[]
}

interface QuizBuilderProps {
  quizData?: QuizData
  onSubmit: (data: QuizData) => Promise<void>
  onCancel: () => void
}

export function QuizBuilder({ quizData, onSubmit, onCancel }: QuizBuilderProps) {
  const [loading, setLoading] = useState(false)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState<QuizData>({
    title: quizData?.title || '',
    description: quizData?.description || '',
    passing_score: quizData?.passing_score || 70,
    time_limit_minutes: quizData?.time_limit_minutes || undefined,
    questions: quizData?.questions || [],
  })

  const generateId = () => Math.random().toString(36).substring(7)

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: generateId(),
      question_text: '',
      question_type: 'multiple_choice',
      points: 1,
      options: [
        { id: generateId(), option_text: '', is_correct: false },
        { id: generateId(), option_text: '', is_correct: false },
      ],
    }
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }))
    setExpandedQuestions(prev => new Set(prev).add(newQuestion.id))
  }

  const handleDeleteQuestion = (questionId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta questão?')) return
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId),
    }))
  }

  const handleUpdateQuestion = (questionId: string, data: Partial<Question>) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === questionId ? { ...q, ...data } : q
      ),
    }))
  }

  const handleAddOption = (questionId: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [...q.options, { id: generateId(), option_text: '', is_correct: false }],
          }
        }
        return q
      }),
    }))
  }

  const handleDeleteOption = (questionId: string, optionId: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          const filtered = q.options.filter(opt => opt.id !== optionId)
          return { ...q, options: filtered }
        }
        return q
      }),
    }))
  }

  const handleUpdateOption = (questionId: string, optionId: string, data: Partial<Option>) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options.map(opt =>
              opt.id === optionId ? { ...opt, ...data } : opt
            ),
          }
        }
        return q
      }),
    }))
  }

  const handleToggleOptionCorrect = (questionId: string, optionId: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId && q.question_type === 'multiple_choice') {
          return {
            ...q,
            options: q.options.map(opt =>
              opt.id === optionId
                ? { ...opt, is_correct: !opt.is_correct }
                : opt
            ),
          }
        }
        return q
      }),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!formData.title.trim()) {
      toast({
        title: 'Erro',
        description: 'Título do quiz é obrigatório',
        variant: 'destructive',
      })
      return
    }

    if (formData.questions.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos uma questão',
        variant: 'destructive',
      })
      return
    }

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

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Quiz</CardTitle>
          <CardDescription>Configure as informações gerais do quiz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Título do Quiz *</Label>
            <Input
              id="quiz-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Avaliação Final - Anatomia"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quiz-description">Descrição</Label>
            <Textarea
              id="quiz-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição do quiz..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passing_score">Nota Mínima (%)</Label>
              <Input
                id="passing_score"
                type="number"
                min="0"
                max="100"
                value={formData.passing_score}
                onChange={(e) => setFormData(prev => ({ ...prev, passing_score: parseInt(e.target.value) || 70 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time_limit">Tempo Limite (min)</Label>
              <Input
                id="time_limit"
                type="number"
                min="0"
                value={formData.time_limit_minutes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, time_limit_minutes: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Questões</h3>
            <p className="text-sm text-muted-foreground">
              {formData.questions.length} questão(ões)
            </p>
          </div>
          <Button type="button" onClick={handleAddQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Questão
          </Button>
        </div>

        <div className="space-y-4">
          {formData.questions.map((question, index) => (
            <Card key={question.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleQuestion(question.id)}
                    >
                      {expandedQuestions.has(question.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                    <CardTitle className="text-base">Questão {index + 1}</CardTitle>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteQuestion(question.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>

              {expandedQuestions.has(question.id) && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pergunta *</Label>
                    <Textarea
                      value={question.question_text}
                      onChange={(e) => handleUpdateQuestion(question.id, { question_text: e.target.value })}
                      placeholder="Digite a pergunta..."
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Questão</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={question.question_type}
                        onChange={(e) => {
                          const newType = e.target.value as any
                          handleUpdateQuestion(question.id, {
                            question_type: newType,
                            correct_answer: newType === 'single_answer' ? question.correct_answer : null,
                          })
                        }}
                      >
                        <option value="multiple_choice">Múltipla Escolha</option>
                        <option value="true_false">Verdadeiro/Falso</option>
                        <option value="single_answer">Resposta Curta</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Pontos</Label>
                      <Input
                        type="number"
                        min="0"
                        value={question.points}
                        onChange={(e) => handleUpdateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>

                  {/* Options for Multiple Choice */}
                  {question.question_type === 'multiple_choice' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Opções de Resposta</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddOption(question.id)}
                        >
                          <Plus className="mr-2 h-3 w-3" />
                          Adicionar Opção
                        </Button>
                      </div>
                      {question.options.map((option) => (
                        <div key={option.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={option.is_correct}
                            onChange={() => handleToggleOptionCorrect(question.id, option.id)}
                            className="rounded"
                          />
                          <Input
                            value={option.option_text}
                            onChange={(e) => handleUpdateOption(question.id, option.id, { option_text: e.target.value })}
                            placeholder="Digite a opção..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteOption(question.id, option.id)}
                            disabled={question.options.length <= 2}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Marque as opções corretas acima
                      </p>
                    </div>
                  )}

                  {/* Answer for Single Answer */}
                  {question.question_type === 'single_answer' && (
                    <div className="space-y-2">
                      <Label>Resposta Correta</Label>
                      <Input
                        value={question.correct_answer || ''}
                        onChange={(e) => handleUpdateQuestion(question.id, { correct_answer: e.target.value })}
                        placeholder="Digite a resposta correta..."
                      />
                    </div>
                  )}

                  {/* True/False */}
                  {question.question_type === 'true_false' && (
                    <div className="space-y-2">
                      <Label>Resposta Correta</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={question.correct_answer || ''}
                        onChange={(e) => handleUpdateQuestion(question.id, { correct_answer: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        <option value="true">Verdadeiro</option>
                        <option value="false">Falso</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? 'Salvando...' : 'Salvar Quiz'}
        </Button>
      </div>
    </form>
  )
}
