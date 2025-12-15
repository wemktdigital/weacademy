'use client'

import { useEffect } from 'react'
import { ChatModelSelector } from './ChatModelSelector'
import { Card } from '@/components/ui/card'
import { AVAILABLE_MODELS, ModelCapabilities } from '@/modules/laboratorio-ia/config/models'

interface DualModelSelectorProps {
  modelA: { provider: string; model: string }
  modelB: { provider: string; model: string }
  onModelAChange: (provider: string, model: string) => void
  onModelBChange: (provider: string, model: string) => void
}

// Função para verificar se dois modelos são compatíveis
function areModelsCompatible(
  modelA: { provider: string; model: string },
  modelB: { provider: string; model: string }
): boolean {
  const modelAData = AVAILABLE_MODELS.find(
    m => m.provider === modelA.provider && m.model === modelA.model
  )
  const modelBData = AVAILABLE_MODELS.find(
    m => m.provider === modelB.provider && m.model === modelB.model
  )

  // Se algum modelo não for encontrado ou não tiver capacidades definidas, permitir
  if (!modelAData?.capabilities || !modelBData?.capabilities) {
    return true
  }

  const capA = modelAData.capabilities!
  const capB = modelBData.capabilities!

  // Verificar compatibilidade de input: devem ter pelo menos um tipo de input em comum
  const compatibleInput = capA.input.some(input => capB.input.includes(input))
  
  // Verificar compatibilidade de output: devem ter pelo menos um tipo de output em comum
  const compatibleOutput = capA.output.some(output => capB.output.includes(output))

  return compatibleInput && compatibleOutput
}

// Função para obter modelos compatíveis com o modelo A
function getCompatibleModels(modelA: { provider: string; model: string }) {
  return AVAILABLE_MODELS.filter(model => {
    // Não incluir o próprio modelo A
    if (model.provider === modelA.provider && model.model === modelA.model) {
      return false
    }
    return areModelsCompatible(modelA, { provider: model.provider, model: model.model })
  })
}

export function DualModelSelector({
  modelA,
  modelB,
  onModelAChange,
  onModelBChange,
}: DualModelSelectorProps) {
  // Obter modelos compatíveis com o Modelo A
  const compatibleModels = getCompatibleModels(modelA)
  
  // Verificar se o Modelo B atual é compatível
  const isModelBCompatible = areModelsCompatible(modelA, modelB)
  
  // Se o Modelo B não for compatível, resetar para o primeiro modelo compatível
  const handleModelAChange = (provider: string, model: string) => {
    onModelAChange(provider, model)
    
    // Verificar se o Modelo B atual ainda é compatível com o novo Modelo A
    const newModelA = { provider, model }
    const newCompatibleModels = getCompatibleModels(newModelA)
    
    if (!areModelsCompatible(newModelA, modelB)) {
      // Encontrar o primeiro modelo compatível
      if (newCompatibleModels.length > 0) {
        const firstCompatible = newCompatibleModels[0]
        onModelBChange(firstCompatible.provider, firstCompatible.model)
      }
    }
  }
  
  // Verificar compatibilidade inicial e ajustar se necessário
  useEffect(() => {
    if (!isModelBCompatible && compatibleModels.length > 0) {
      const firstCompatible = compatibleModels[0]
      onModelBChange(firstCompatible.provider, firstCompatible.model)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelA.provider, modelA.model])

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-3">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Modelo A</div>
        <ChatModelSelector
          provider={modelA.provider}
          model={modelA.model}
          onChange={handleModelAChange}
        />
      </Card>
      <Card className="p-3">
        <div className="text-xs text-muted-foreground mb-2 font-medium">
          Modelo B
          {!isModelBCompatible && (
            <span className="ml-2 text-xs text-destructive">(Incompatível)</span>
          )}
        </div>
        <ChatModelSelector
          provider={modelB.provider}
          model={modelB.model}
          onChange={onModelBChange}
          filterCompatibleWith={modelA}
        />
      </Card>
    </div>
  )
}

