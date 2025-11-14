'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Sparkles, Zap, Shield, DollarSign } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

interface RoutingPreferences {
  intelligentRoutingEnabled: boolean
  maxCostUsd: number | null
  preferSpeed: boolean
  preferAccuracy: boolean
}

interface RoutingPreferencesDialogProps {
  preferences: RoutingPreferences
  onPreferencesChange: (preferences: RoutingPreferences) => void
}

export function RoutingPreferencesDialog({
  preferences,
  onPreferencesChange,
}: RoutingPreferencesDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localPreferences, setLocalPreferences] = useState<RoutingPreferences>(preferences)

  useEffect(() => {
    setLocalPreferences(preferences)
  }, [preferences])

  const handleSave = async () => {
    setLoading(true)
    try {
      // Verificar se há sessão ativa
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !sessionData?.session) {
        toast({
          title: 'Erro de autenticação',
          description: 'Por favor, faça login novamente.',
          variant: 'destructive',
        })
        return
      }

      // Obter token para enviar no header (fallback para cookies)
      const token = sessionData.session.access_token

      const response = await fetch('/api/lab-ia/routing/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        credentials: 'include', // Importante: incluir cookies na requisição
        body: JSON.stringify({
          intelligentRoutingEnabled: localPreferences.intelligentRoutingEnabled,
          maxCostUsd: localPreferences.maxCostUsd || null,
          preferSpeed: localPreferences.preferSpeed,
          preferAccuracy: localPreferences.preferAccuracy,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        
        if (response.status === 401) {
          toast({
            title: 'Erro de autenticação',
            description: 'Sua sessão expirou. Por favor, faça login novamente.',
            variant: 'destructive',
          })
          return
        }
        
        throw new Error(errorData.error || 'Erro ao salvar preferências')
      }

      const result = await response.json()
      
      if (result.success) {
        onPreferencesChange(localPreferences)
        setOpen(false)
        toast({
          title: 'Preferências salvas',
          description: 'Suas preferências de routing foram atualizadas.',
        })
      } else {
        throw new Error(result.error || 'Erro ao salvar preferências')
      }
    } catch (error: any) {
      console.error('Erro ao salvar preferências:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as preferências',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Preferências
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Preferências de Routing Inteligente
          </DialogTitle>
          <DialogDescription>
            Configure como o sistema escolhe automaticamente o melhor modelo para suas tarefas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Toggle Routing Inteligente */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="routing-enabled" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Routing Inteligente
              </Label>
              <p className="text-sm text-muted-foreground">
                Escolha automática do melhor modelo baseado na tarefa
              </p>
            </div>
            <Switch
              id="routing-enabled"
              checked={localPreferences.intelligentRoutingEnabled}
              onCheckedChange={(checked) =>
                setLocalPreferences((prev) => ({ ...prev, intelligentRoutingEnabled: checked }))
              }
            />
          </div>

          {/* Custo Máximo */}
          <div className="space-y-2">
            <Label htmlFor="max-cost" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Custo Máximo por Requisição (USD)
            </Label>
            <Input
              id="max-cost"
              type="number"
              step="0.0001"
              min="0"
              placeholder="0.01"
              value={localPreferences.maxCostUsd || ''}
              onChange={(e) =>
                setLocalPreferences((prev) => ({
                  ...prev,
                  maxCostUsd: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              O sistema evitará modelos que excedam este custo
            </p>
          </div>

          {/* Preferências */}
          <div className="space-y-4">
            <Label>Preferências de Performance</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="prefer-speed" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Priorizar Velocidade
                </Label>
                <p className="text-sm text-muted-foreground">
                  Escolher modelos mais rápidos quando possível
                </p>
              </div>
              <Switch
                id="prefer-speed"
                checked={localPreferences.preferSpeed}
                onCheckedChange={(checked) =>
                  setLocalPreferences((prev) => ({ ...prev, preferSpeed: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="prefer-accuracy" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Priorizar Precisão
                </Label>
                <p className="text-sm text-muted-foreground">
                  Escolher modelos mais precisos quando possível
                </p>
              </div>
              <Switch
                id="prefer-accuracy"
                checked={localPreferences.preferAccuracy}
                onCheckedChange={(checked) =>
                  setLocalPreferences((prev) => ({ ...prev, preferAccuracy: checked }))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

