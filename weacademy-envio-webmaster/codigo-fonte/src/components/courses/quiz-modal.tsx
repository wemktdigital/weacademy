'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'single_answer'
  points: number
  correct_answer?: string | null
  options?: {
    id: string
    option_text: string
    is_correct: boolean
  }[]
}

interface Quiz {
  id: string
  title: string
  description?: string
  passing_score: number
  time_limit_minutes?: number
  questions: Question[]
}

interface QuizModalProps {
  quiz: Quiz
  open: boolean
  onClose: () => void
  onSubmit: (answers: Record<string, any>) => Promise<void>
}

export function QuizModal({ quiz, open, onClose, onSubmit }: QuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Timer
  useEffect(() => {
    if (!open || !quiz.time_limit_minutes) return

    setTimeRemaining(quiz.time_limit_minutes * 60)
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open, quiz.time_limit_minutes])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentQuestion = quiz.questions[currentQuestionIndex]

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await onSubmit(answers)
      setResult(result)
      setShowResults(true)
    } catch (error) {
      console.error('Error submitting quiz:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setCurrentQuestionIndex(0)
    setAnswers({})
    setShowResults(false)
    setResult(null)
    setTimeRemaining(null)
    onClose()
  }

  const isAnswered = (questionId: string) => answers[questionId] !== undefined

  if (showResults && result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Resultado do Quiz</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className={result.passed ? 'bg-green-50 dark:bg-green-950/20 border-green-500' : 'bg-red-50 dark:bg-red-950/20 border-red-500'}>
              {result.passed ? (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <AlertDescription className="font-semibold">
                {result.passed ? 'Parabéns! Você passou!' : 'Você não atingiu a nota mínima'}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Sua Pontuação</div>
                <div className="text-2xl font-bold text-primary">{result.score}%</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Nota Mínima</div>
                <div className="text-2xl font-bold">{result.passing_score}%</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Pontos Obtidos:</span>
                <span className="font-semibold">{result.earnedPoints} de {result.totalPoints}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleClose} className="flex-1">
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{quiz.title}</DialogTitle>
              {quiz.description && (
                <DialogDescription>{quiz.description}</DialogDescription>
              )}
            </div>
            {timeRemaining !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg">
                <Clock className="h-4 w-4" />
                <span className="font-mono text-sm font-semibold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {currentQuestionIndex + 1} / {quiz.questions.length}
            </span>
          </div>

          {/* Question */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {currentQuestion.question_text}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentQuestion.points} ponto(s)
              </p>
            </div>

            {/* Answers */}
            {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options ? (
              <RadioGroup
                value={answers[currentQuestion.id]}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              >
                <div className="space-y-2">
                  {currentQuestion.options.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.id} id={option.id} />
                      <Label
                        htmlFor={option.id}
                        className="flex-1 cursor-pointer py-2 px-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        {option.option_text}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : currentQuestion.question_type === 'true_false' ? (
              <RadioGroup
                value={answers[currentQuestion.id]}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true" id="true" />
                    <Label htmlFor="true" className="cursor-pointer py-2 px-3 rounded-lg hover:bg-accent transition-colors flex-1">
                      Verdadeiro
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="false" id="false" />
                    <Label htmlFor="false" className="cursor-pointer py-2 px-3 rounded-lg hover:bg-accent transition-colors flex-1">
                      Falso
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            ) : (
              <textarea
                className="w-full min-h-[100px] p-3 border rounded-lg resize-none"
                placeholder="Digite sua resposta..."
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              Anterior
            </Button>

            <div className="flex gap-2">
              {quiz.questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                    idx === currentQuestionIndex
                      ? 'bg-primary text-primary-foreground'
                      : isAnswered(q.id)
                      ? 'bg-green-500 text-white'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {currentQuestionIndex < quiz.questions.length - 1 ? (
              <Button onClick={handleNext}>Próxima</Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(answers).length < quiz.questions.length}
              >
                {isSubmitting ? 'Enviando...' : 'Finalizar Quiz'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
