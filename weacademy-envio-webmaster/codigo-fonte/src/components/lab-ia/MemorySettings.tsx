'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Brain, ExternalLink } from 'lucide-react'
import NextLink from 'next/link'

interface MemorySettingsProps {
  onClose?: () => void
}

export function MemorySettings({ onClose }: MemorySettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    memory_enabled: true,
    memory_auto_extract: true,
    memory_reference_history: false,
  })

  useEffect(() => {
    if (user) {
      loadSettings()
    }
  }, [user])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        console.warn('[MemorySettings] Token não encontrado, usando configurações padrão')
        // Usar configurações padrão se não autenticado
        return
      }

      const response = await fetch('/api/lab-ia/memory/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        // Se for 401, usar configurações padrão
        if (response.status === 401) {
          console.warn('[MemorySettings] Não autenticado, usando configurações padrão')
          return
        }
        
        // Se for 404 ou erro de servidor, usar configurações padrão (migration pode não ter sido executada)
        if (response.status === 404 || response.status >= 500) {
          console.warn('[MemorySettings] Erro ao buscar configurações, usando padrões. Status:', response.status)
          return
        }

        // Tentar obter mensagem de erro mais específica
        let errorMessage = 'Erro ao carregar configurações'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro, usar mensagem padrão
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()
      setSettings({
        memory_enabled: data.memory_enabled ?? true,
        memory_auto_extract: data.memory_auto_extract ?? true,
        memory_reference_history: data.memory_reference_history ?? false,
      })
    } catch (error: any) {
      console.error('[MemorySettings] Erro ao carregar configurações:', error)
      // Não mostrar toast para erros esperados (404, etc) - apenas usar padrões
      if (error.message && !error.message.includes('Erro ao carregar')) {
        toast({
          title: 'Aviso',
          description: 'Usando configurações padrão. Algumas funcionalidades podem estar limitadas.',
          variant: 'default',
        })
      }
      // Manter configurações padrão em caso de erro
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar autenticado para salvar configurações',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/memory/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        // Tentar obter mensagem de erro mais específica
        let errorMessage = 'Erro ao salvar configurações'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro
        }

        // Se for 500, pode ser que a migration não foi executada
        if (response.status === 500) {
          errorMessage = 'Erro no servidor. Verifique se a migration foi executada.'
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Atualizar settings com os valores retornados
      setSettings({
        memory_enabled: data.memory_enabled ?? true,
        memory_auto_extract: data.memory_auto_extract ?? true,
        memory_reference_history: data.memory_reference_history ?? false,
      })

      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências de memória foram atualizadas.',
      })

      if (onClose) {
        onClose()
      }
    } catch (error: any) {
      console.error('[MemorySettings] Erro ao salvar configurações:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <CardTitle>Configurações de Memória</CardTitle>
        </div>
        <CardDescription>
          Controle como o Laboratório de IA usa suas informações para personalizar respostas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="memory_enabled" className="text-base font-medium">
                Referenciar memórias salvas
              </Label>
              <p className="text-sm text-muted-foreground">
                Permitir que o Laboratório de IA use memórias salvas ao responder
              </p>
            </div>
            <Switch
              id="memory_enabled"
              checked={settings.memory_enabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, memory_enabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="memory_auto_extract" className="text-base font-medium">
                Extração automática de memórias
              </Label>
              <p className="text-sm text-muted-foreground">
                Permitir que o Laboratório de IA salve automaticamente informações úteis das conversas
              </p>
            </div>
            <Switch
              id="memory_auto_extract"
              checked={settings.memory_auto_extract}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, memory_auto_extract: checked }))
              }
              disabled={!settings.memory_enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="memory_reference_history" className="text-base font-medium">
                Referenciar histórico de chats
              </Label>
              <p className="text-sm text-muted-foreground">
                Permitir que o Laboratório de IA referencie todas as conversas anteriores ao responder
              </p>
            </div>
            <Switch
              id="memory_reference_history"
              checked={settings.memory_reference_history}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, memory_reference_history: checked }))
              }
              disabled={!settings.memory_enabled}
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <NextLink href="/ai-lab/memory">
            <Button variant="outline" className="w-full" asChild>
              <span>
                <ExternalLink className="h-4 w-4 mr-2" />
                Gerenciar memórias
              </span>
            </Button>
          </NextLink>
        </div>

        <div className="flex gap-2">
          <Button onClick={saveSettings} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configurações
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>
            O Laboratório de IA pode usar a Memória para personalizar consultas e respostas.
            Todas as informações são armazenadas de forma segura e privada.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

