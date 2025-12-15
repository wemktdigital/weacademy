'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
import type { Condition } from '@/modules/laboratorio-ia/services/conditionEvaluator'

interface ConditionConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  condition: Condition | null
  mergeStrategy?: 'concat' | 'first' | 'last' | 'longest'
  onSave: (condition: Condition | null, mergeStrategy?: 'concat' | 'first' | 'last' | 'longest') => void
}

export function ConditionConfigDialog({
  open,
  onOpenChange,
  condition: initialCondition,
  mergeStrategy: initialMergeStrategy,
  onSave,
}: ConditionConfigDialogProps) {
  const [enabled, setEnabled] = useState(!!initialCondition)
  const [type, setType] = useState<Condition['type']>(initialCondition?.type || 'contains')
  const [value, setValue] = useState<string>(String(initialCondition?.value || ''))
  const [operator, setOperator] = useState<Condition['operator']>(initialCondition?.operator || 'equals')
  const [mergeStrategy, setMergeStrategy] = useState<'concat' | 'first' | 'last' | 'longest'>(initialMergeStrategy || 'concat')

  useEffect(() => {
    if (open) {
      setEnabled(!!initialCondition)
      setType(initialCondition?.type || 'contains')
      setValue(String(initialCondition?.value || ''))
      setOperator(initialCondition?.operator || 'equals')
      setMergeStrategy(initialMergeStrategy || 'concat')
    }
  }, [open, initialCondition, initialMergeStrategy])

  const handleSave = () => {
    if (!enabled) {
      onSave(null, mergeStrategy)
    } else {
      const conditionValue = type === 'length' || type === 'sentiment' 
        ? parseInt(value, 10)
        : value
      
      if (isNaN(conditionValue as number) && (type === 'length' || type === 'sentiment')) {
        return // Valor inválido
      }

      const condition: Condition = {
        type,
        value: conditionValue,
        operator: type === 'length' || type === 'sentiment' ? operator : undefined,
      }

      onSave(condition, mergeStrategy)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Condição Condicional</DialogTitle>
          <DialogDescription>
            Defina uma condição para executar este agente baseado no contexto anterior
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Enable/Disable Condition */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-condition">Ativar Condição Condicional</Label>
            <Switch
              id="enable-condition"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* Condition Type */}
              <div className="space-y-2">
                <Label htmlFor="condition-type">Tipo de Condição</Label>
                <Select value={type} onValueChange={(v) => setType(v as Condition['type'])}>
                  <SelectTrigger id="condition-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém texto</SelectItem>
                    <SelectItem value="length">Comprimento do texto</SelectItem>
                    <SelectItem value="regex">Expressão regular</SelectItem>
                    <SelectItem value="sentiment">Sentimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Condition Value */}
              <div className="space-y-2">
                <Label htmlFor="condition-value">
                  {type === 'contains' && 'Texto a procurar'}
                  {type === 'length' && 'Comprimento alvo'}
                  {type === 'regex' && 'Expressão regular (ex: ^[A-Z].*$)'}
                  {type === 'sentiment' && 'Sentimento (0=negativo, 1=neutro, 2=positivo)'}
                </Label>
                <Input
                  id="condition-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    type === 'contains' ? 'ex: compliance'
                      : type === 'length' ? 'ex: 100'
                      : type === 'regex' ? 'ex: ^[A-Z].*$'
                      : 'ex: 2'
                  }
                  type={type === 'length' || type === 'sentiment' ? 'number' : 'text'}
                />
              </div>

              {/* Operator (for length and sentiment) */}
              {(type === 'length' || type === 'sentiment') && (
                <div className="space-y-2">
                  <Label htmlFor="condition-operator">Operador</Label>
                  <Select value={operator} onValueChange={(v) => setOperator(v as Condition['operator'])}>
                    <SelectTrigger id="condition-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Igual a</SelectItem>
                      <SelectItem value="greater">Maior que</SelectItem>
                      <SelectItem value="less">Menor que</SelectItem>
                      <SelectItem value="not_equals">Diferente de</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Merge Strategy */}
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="merge-strategy">Estratégia de Merge (se múltiplos caminhos)</Label>
                <Select value={mergeStrategy} onValueChange={(v) => setMergeStrategy(v as typeof mergeStrategy)}>
                  <SelectTrigger id="merge-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concat">Concatenar todos</SelectItem>
                    <SelectItem value="first">Usar primeiro</SelectItem>
                    <SelectItem value="last">Usar último</SelectItem>
                    <SelectItem value="longest">Usar mais longo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quando múltiplos branches executam na mesma ordem, como combinar os outputs?
                </p>
              </div>
            </>
          )}

          {/* Examples */}
          {enabled && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-semibold mb-2">Exemplos:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Contém:</strong> "compliance" → executa se texto contém "compliance"</li>
                <li><strong>Comprimento:</strong> length &gt; 500 → executa se texto tem mais de 500 caracteres</li>
                <li><strong>Regex:</strong> ^[A-Z].*$ → executa se texto começa com maiúscula</li>
                <li><strong>Sentimento:</strong> sentiment = 2 → executa se sentimento é positivo</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

