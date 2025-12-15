'use client'

import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConditionsEditor } from './ConditionsEditor'

export interface Achievement {
  id?: string
  code: string
  name: string
  description: string
  icon: string
  category: 'courses' | 'quizzes' | 'lab-ia' | 'community' | 'special'
  points: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  conditions: Record<string, any>
  active: boolean
  sort_order: number
}

interface AchievementFormProps {
  achievement?: Achievement
  onSubmit: (data: Achievement) => Promise<void>
  onCancel: () => void
}

const CATEGORIES = ['courses', 'quizzes', 'lab-ia', 'community', 'special'] as const
const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
const RARITY_COLORS = {
  common: 'bg-gray-100 text-gray-800',
  rare: 'bg-blue-100 text-blue-800',
  epic: 'bg-purple-100 text-purple-800',
  legendary: 'bg-yellow-100 text-yellow-800',
}

export function AchievementForm({ achievement, onSubmit, onCancel }: AchievementFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Achievement>({
    code: achievement?.code || '',
    name: achievement?.name || '',
    description: achievement?.description || '',
    icon: achievement?.icon || '🏆',
    category: achievement?.category || 'courses',
    points: achievement?.points || 0,
    rarity: achievement?.rarity || 'common',
    conditions: achievement?.conditions || {},
    active: achievement?.active ?? true,
    sort_order: achievement?.sort_order || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!formData.code.trim()) {
      toast.error('Código é obrigatório')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Descrição é obrigatória')
      return
    }

    if (formData.points < 0) {
      toast.error('Pontos devem ser maiores ou iguais a zero')
      return
    }

    try {
      setLoading(true)
      await onSubmit(formData)
      toast.success(achievement ? 'Achievement atualizado com sucesso!' : 'Achievement criado com sucesso!')
    } catch (error: any) {
      console.error('Error submitting achievement:', error)
      toast.error(error.message || 'Erro ao salvar achievement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{achievement ? 'Editar Achievement' : 'Criar Achievement'}</CardTitle>
          <CardDescription>
            Configure as propriedades do achievement/badge
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Código */}
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.trim().toLowerCase().replace(/\s+/g, '_') }))}
              placeholder="ex: first_lesson"
              required
              disabled={!!achievement} // Não permitir alterar código de achievements existentes
              className={achievement ? 'bg-muted' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Identificador único (não pode ser alterado após criação)
            </p>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="ex: Primeiro Passo"
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="ex: Complete sua primeira aula"
              rows={3}
              required
            />
          </div>

          {/* Ícone e Preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="🏆"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <span className="text-2xl">{formData.icon || '🏆'}</span>
                <div className="flex-1">
                  <p className="font-semibold">{formData.name || 'Nome do Achievement'}</p>
                  <p className="text-sm text-muted-foreground">{formData.description || 'Descrição'}</p>
                </div>
                <Badge className={RARITY_COLORS[formData.rarity]}>
                  {formData.rarity}
                </Badge>
              </div>
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select
              value={formData.category}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pontos e Raridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="points">Pontos</Label>
              <Input
                id="points"
                type="number"
                min="0"
                value={formData.points}
                onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rarity">Raridade</Label>
              <Select
                value={formData.rarity}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, rarity: value }))}
              >
                <SelectTrigger id="rarity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((rarity) => (
                    <SelectItem key={rarity} value={rarity}>
                      <span className="flex items-center gap-2">
                        <Badge className={RARITY_COLORS[rarity]} variant="outline">
                          {rarity}
                        </Badge>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Condições */}
          <div className="space-y-2">
            <Label>Condições de Desbloqueio</Label>
            <ConditionsEditor
              conditions={formData.conditions}
              onChange={(conditions) => setFormData(prev => ({ ...prev, conditions }))}
            />
          </div>

          {/* Ordem e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sort_order">Ordem</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Achievement Ativo
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          {achievement ? 'Atualizar' : 'Criar'} Achievement
        </Button>
      </div>
    </form>
  )
}

