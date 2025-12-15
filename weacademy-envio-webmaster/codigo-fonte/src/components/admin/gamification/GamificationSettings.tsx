'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Plus, X, Users, Settings as SettingsIcon } from 'lucide-react'
import { toast } from 'sonner'

interface GamificationSettings {
  settings: {
    xp_multiplier: number
    streak_bonus: number
  }
  enabled: boolean
  beta_users: string[]
}

interface GamificationSettingsProps {
  settings?: GamificationSettings
  onSave: (data: GamificationSettings) => Promise<void>
  loading?: boolean
}

export function GamificationSettings({
  settings: initialSettings,
  onSave,
  loading = false,
}: GamificationSettingsProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<GamificationSettings>({
    settings: {
      xp_multiplier: initialSettings?.settings?.xp_multiplier ?? 1.0,
      streak_bonus: initialSettings?.settings?.streak_bonus ?? 0.1,
    },
    enabled: initialSettings?.enabled ?? true,
    beta_users: initialSettings?.beta_users || [],
  })
  const [newBetaUser, setNewBetaUser] = useState('')

  useEffect(() => {
    if (initialSettings) {
      setFormData(initialSettings)
    }
  }, [initialSettings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações
    if (formData.settings.xp_multiplier < 0) {
      toast.error('Multiplicador de XP deve ser maior ou igual a zero')
      return
    }

    if (formData.settings.streak_bonus < 0) {
      toast.error('Bônus de streak deve ser maior ou igual a zero')
      return
    }

    try {
      setSaving(true)
      await onSave(formData)
      toast.success('Configurações salvas com sucesso!')
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error(error.message || 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const addBetaUser = () => {
    if (!newBetaUser.trim()) {
      toast.error('Email ou ID de usuário é obrigatório')
      return
    }

    if (formData.beta_users.includes(newBetaUser.trim())) {
      toast.error('Usuário já está na lista de beta')
      return
    }

    setFormData(prev => ({
      ...prev,
      beta_users: [...prev.beta_users, newBetaUser.trim()],
    }))
    setNewBetaUser('')
  }

  const removeBetaUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      beta_users: prev.beta_users.filter(id => id !== userId),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Configurações de Gamificação
          </CardTitle>
          <CardDescription>
            Configure as opções gerais do sistema de gamificação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Geral */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Sistema de Gamificação</Label>
                <p className="text-sm text-muted-foreground">
                  Ativar ou desativar o sistema de gamificação para todos os usuários
                </p>
              </div>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, enabled: checked }))
                }
              />
            </div>
          </div>

          <Separator />

          {/* Configurações de XP */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configurações de XP</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="xp_multiplier">Multiplicador de XP</Label>
                <Input
                  id="xp_multiplier"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.settings.xp_multiplier}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        xp_multiplier: parseFloat(e.target.value) || 1.0,
                      },
                    }))
                  }
                  placeholder="1.0"
                />
                <p className="text-xs text-muted-foreground">
                  Multiplica todos os pontos de XP concedidos (ex: 1.5 = 50% mais XP)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streak_bonus">Bônus de Streak</Label>
                <Input
                  id="streak_bonus"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.settings.streak_bonus}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        streak_bonus: parseFloat(e.target.value) || 0.1,
                      },
                    }))
                  }
                  placeholder="0.1"
                />
                <p className="text-xs text-muted-foreground">
                  Bônus adicional de XP por dia de streak (ex: 0.1 = 10% de bônus)
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Usuários Beta */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Usuários Beta</Label>
                <p className="text-sm text-muted-foreground">
                  Usuários que têm acesso antecipado a novas funcionalidades de gamificação
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newBetaUser}
                  onChange={(e) => setNewBetaUser(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addBetaUser()
                    }
                  }}
                  placeholder="Email ou ID do usuário"
                />
                <Button type="button" onClick={addBetaUser} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {formData.beta_users.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.beta_users.map((userId) => (
                    <Badge key={userId} variant="secondary" className="px-3 py-1">
                      <Users className="h-3 w-3 mr-1" />
                      {userId}
                      <button
                        type="button"
                        onClick={() => removeBetaUser(userId)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {formData.beta_users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum usuário beta adicionado
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving || loading}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </form>
  )
}

