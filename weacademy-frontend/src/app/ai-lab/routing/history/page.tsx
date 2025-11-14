'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sparkles, Calendar } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'

interface RecommendationHistory {
  id: string
  original_provider: string
  original_model: string
  recommended_provider: string
  recommended_model: string
  recommendation_score: number
  recommendation_reason: string
  task_category: string | null
  prompt_preview: string | null
  accepted: boolean
  created_at: string
}

export default function RecommendationsHistoryPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [history, setHistory] = useState<RecommendationHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadHistory()
    }
  }, [user])

  const loadHistory = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/routing/recommendations-history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar histórico')
      }

      const data = await response.json()
      setHistory(data.history || [])
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar o histórico',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getModelDisplayName = (provider: string, model: string) => {
    const found = AVAILABLE_MODELS.find(m => m.provider === provider && m.model === model)
    return found?.displayName || model
  }

  const getModelIcon = (provider: string, model: string) => {
    const found = AVAILABLE_MODELS.find(m => m.provider === provider && m.model === model)
    return found?.icon || '🤖'
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Autenticação necessária</CardTitle>
            <CardDescription>Faça login para ver seu histórico de recomendações.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/ai-lab">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Chat
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Histórico de Recomendações</h1>
              <p className="text-muted-foreground">
                Veja quando você aceitou recomendações automáticas de modelos
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Recomendações */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Carregando histórico...</p>
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma recomendação aceita ainda</h3>
              <p className="text-muted-foreground">
                Quando você aceitar recomendações automáticas de modelos, elas aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">
                          {getModelIcon(item.original_provider, item.original_model)}
                        </span>
                        <span className="font-medium">
                          {getModelDisplayName(item.original_provider, item.original_model)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-lg text-primary">
                          {getModelIcon(item.recommended_provider, item.recommended_model)}
                        </span>
                        <span className="font-medium text-primary">
                          {getModelDisplayName(item.recommended_provider, item.recommended_model)}
                        </span>
                      </div>
                      <CardDescription className="mt-1">
                        {item.recommendation_reason}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      Score: {item.recommendation_score}/100
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {item.task_category && (
                      <Badge variant="outline">{item.task_category}</Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(item.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  {item.prompt_preview && (
                    <div className="mt-3 p-2 bg-muted rounded text-sm">
                      <span className="text-muted-foreground">Prompt: </span>
                      {item.prompt_preview}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

