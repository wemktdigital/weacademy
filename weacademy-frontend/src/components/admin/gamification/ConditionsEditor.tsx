'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Code } from 'lucide-react'

interface Condition {
  type: string
  operator: string
  value: number
}

interface ConditionsEditorProps {
  conditions: Record<string, any>
  onChange: (conditions: Record<string, any>) => void
}

const CONDITION_TYPES = [
  { value: 'courses_completed', label: 'Cursos Completos' },
  { value: 'lessons_completed', label: 'Aulas Completas' },
  { value: 'quizzes_passed', label: 'Quizzes Passados' },
  { value: 'quizzes_perfect_score', label: 'Quizzes com 100%' },
  { value: 'streak_days', label: 'Dias de Sequência' },
  { value: 'certificates_count', label: 'Certificados Obtidos' },
] as const

const OPERATORS = [
  { value: '>=', label: 'Maior ou igual (≥)' },
  { value: '=', label: 'Igual (=)' },
  { value: '<=', label: 'Menor ou igual (≤)' },
] as const

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const [localConditions, setLocalConditions] = useState<Condition[]>(() => {
    // Converter condições do objeto para array
    return Object.entries(conditions)
      .filter(([key]) => CONDITION_TYPES.some(ct => ct.value === key))
      .map(([type, value]) => ({
        type,
        operator: '>=',
        value: typeof value === 'number' ? value : 0,
      }))
  })

  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [jsonInput, setJsonInput] = useState(JSON.stringify(conditions, null, 2))

  const updateConditions = (newConditions: Condition[]) => {
    setLocalConditions(newConditions)
    
    // Converter array de condições para objeto
    const conditionsObj: Record<string, any> = {}
    newConditions.forEach(condition => {
      if (condition.type && condition.value !== undefined) {
        conditionsObj[condition.type] = condition.value
      }
    })
    
    onChange(conditionsObj)
  }

  const addCondition = () => {
    updateConditions([
      ...localConditions,
      {
        type: 'courses_completed',
        operator: '>=',
        value: 1,
      },
    ])
  }

  const removeCondition = (index: number) => {
    updateConditions(localConditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, field: keyof Condition, value: any) => {
    const updated = [...localConditions]
    updated[index] = { ...updated[index], [field]: value }
    updateConditions(updated)
  }

  const handleJsonUpdate = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      onChange(parsed)
      
      // Atualizar condições locais
      const newConditions: Condition[] = Object.entries(parsed)
        .filter(([key]) => CONDITION_TYPES.some(ct => ct.value === key))
        .map(([type, value]) => ({
          type,
          operator: '>=',
          value: typeof value === 'number' ? value : 0,
        }))
      
      setLocalConditions(newConditions)
      setShowJsonEditor(false)
    } catch (error) {
      alert('JSON inválido')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Condições</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowJsonEditor(!showJsonEditor)}
            >
              <Code className="h-4 w-4 mr-2" />
              {showJsonEditor ? 'Editor Visual' : 'Editor JSON'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showJsonEditor ? (
          <div className="space-y-2">
            <Label>JSON das Condições</Label>
            <textarea
              className="w-full h-32 p-2 border rounded-md font-mono text-sm"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"courses_completed": 5}'
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={handleJsonUpdate}>
                Atualizar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {localConditions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma condição definida. Adicione condições para que o achievement seja desbloqueado automaticamente.
              </p>
            ) : (
              <div className="space-y-3">
                {localConditions.map((condition, index) => (
                  <div key={index} className="flex gap-2 items-end p-3 border rounded-md">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={condition.type}
                          onValueChange={(value) => updateCondition(index, 'type', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITION_TYPES.map((ct) => (
                              <SelectItem key={ct.value} value={ct.value}>
                                {ct.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Operador</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) => updateCondition(index, 'operator', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor</Label>
                        <Input
                          type="number"
                          min="0"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', parseInt(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeCondition(index)}
                      className="h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <Button type="button" variant="outline" onClick={addCondition} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Condição
            </Button>

            {/* Preview JSON */}
            {localConditions.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">JSON Gerado:</p>
                <code className="text-xs font-mono">
                  {JSON.stringify(
                    Object.fromEntries(
                      localConditions.map(c => [c.type, c.value])
                    ),
                    null,
                    2
                  )}
                </code>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

