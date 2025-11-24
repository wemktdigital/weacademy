'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, X, Palette } from 'lucide-react'
import { toast } from 'sonner'

export interface Level {
  id?: string
  level_number: number
  name: string
  min_xp: number
  max_xp: number | null
  icon: string
  color: string
  benefits: string[]
  sort_order: number
}

interface LevelFormProps {
  level?: Level
  onSubmit: (data: Level) => Promise<void>
  onCancel: () => void
}

const DEFAULT_COLORS = [
  { name: 'Azul', value: '#29CEDF' },
  { name: 'Verde', value: '#25D366' },
  { name: 'Laranja', value: '#FFA500' },
  { name: 'Roxo', value: '#9B59B6' },
  { name: 'Vermelho', value: '#E74C3C' },
  { name: 'Amarelo', value: '#F39C12' },
  { name: 'Rosa', value: '#E91E63' },
  { name: 'Cinza', value: '#95A5A6' },
]

export function LevelForm({ level, onSubmit, onCancel }: LevelFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Level>({
    level_number: level?.level_number || 1,
    name: level?.name || '',
    min_xp: level?.min_xp || 0,
    max_xp: level?.max_xp ?? null,
    icon: level?.icon || '⭐',
    color: level?.color || '#29CEDF',
    benefits: level?.benefits || [],
    sort_order: level?.sort_order || 0,
  })

  const [newBenefit, setNewBenefit] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    if (formData.min_xp < 0) {
      toast.error('XP mínimo deve ser maior ou igual a zero')
      return
    }

    if (formData.max_xp !== null && formData.max_xp <= formData.min_xp) {
      toast.error('XP máximo deve ser maior que XP mínimo')
      return
    }

    if (formData.level_number < 1) {
      toast.error('Número do nível deve ser maior que zero')
      return
    }

    try {
      setLoading(true)
      await onSubmit(formData)
      toast.success(level ? 'Nível atualizado com sucesso!' : 'Nível criado com sucesso!')
    } catch (error: any) {
      console.error('Error submitting level:', error)
      toast.error(error.message || 'Erro ao salvar nível')
    } finally {
      setLoading(false)
    }
  }

  const addBenefit = () => {
    if (!newBenefit.trim()) return
    setFormData(prev => ({
      ...prev,
      benefits: [...prev.benefits, newBenefit.trim()],
    }))
    setNewBenefit('')
  }

  const removeBenefit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{level ? 'Editar Nível' : 'Criar Nível'}</CardTitle>
          <CardDescription>
            Configure as propriedades do nível de gamificação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Número do Nível */}
          <div className="space-y-2">
            <Label htmlFor="level_number">Número do Nível *</Label>
            <Input
              id="level_number"
              type="number"
              min="1"
              value={formData.level_number}
              onChange={(e) => setFormData(prev => ({ ...prev, level_number: parseInt(e.target.value) || 1 }))}
              required
              disabled={!!level} // Não permitir alterar número de níveis existentes
              className={level ? 'bg-muted' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Ordem do nível (não pode ser alterado após criação)
            </p>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="ex: Iniciante, Especialista"
              required
            />
          </div>

          {/* XP Mínimo e Máximo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_xp">XP Mínimo *</Label>
              <Input
                id="min_xp"
                type="number"
                min="0"
                value={formData.min_xp}
                onChange={(e) => setFormData(prev => ({ ...prev, min_xp: parseInt(e.target.value) || 0 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_xp">XP Máximo</Label>
              <Input
                id="max_xp"
                type="number"
                min={formData.min_xp + 1}
                value={formData.max_xp || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, max_xp: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Deixe vazio para nível máximo"
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para nível máximo (sem limite superior)
              </p>
            </div>
          </div>

          {/* Ícone e Cor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="⭐"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 cursor-pointer"
                />
                <div className="flex-1 flex flex-wrap gap-1">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                      className={`w-8 h-8 rounded border-2 ${
                        formData.color === color.value ? 'border-primary' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="flex items-center gap-3 p-4 rounded-lg border"
              style={{ borderColor: formData.color }}
            >
              <span className="text-3xl">{formData.icon || '⭐'}</span>
              <div className="flex-1">
                <p className="font-semibold text-lg" style={{ color: formData.color }}>
                  Nível {formData.level_number}: {formData.name || 'Nome do Nível'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formData.min_xp} - {formData.max_xp || '∞'} XP
                </p>
              </div>
            </div>
          </div>

          {/* Benefícios */}
          <div className="space-y-2">
            <Label>Benefícios do Nível</Label>
            <div className="flex gap-2">
              <Input
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addBenefit()
                  }
                }}
                placeholder="ex: Acesso a cursos premium"
              />
              <Button type="button" onClick={addBenefit}>
                Adicionar
              </Button>
            </div>
            {formData.benefits.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.benefits.map((benefit, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md"
                  >
                    <span className="text-sm">{benefit}</span>
                    <button
                      type="button"
                      onClick={() => removeBenefit(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ordem */}
          <div className="space-y-2">
            <Label htmlFor="sort_order">Ordem</Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
            />
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
          {level ? 'Atualizar' : 'Criar'} Nível
        </Button>
      </div>
    </form>
  )
}

