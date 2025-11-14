'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { AVAILABLE_MODELS, PROVIDERS } from '@/modules/laboratorio-ia/config/models'
import { ModelCapabilitiesBadge } from './ModelCapabilitiesBadge'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODELS = AVAILABLE_MODELS

interface ChatModelSelectorProps {
  provider: string
  model: string
  onChange: (provider: string, model: string) => void
}

export function ChatModelSelector({ provider, model, onChange }: ChatModelSelectorProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  // Encontrar o modelo atual
  const currentModel = MODELS.find(
    m => m.provider === provider && m.model === model
  ) || MODELS[0]

  // Agrupar modelos por provider
  const modelsByProvider = PROVIDERS.map(providerObj => ({
    provider: providerObj.value,
    providerLabel: providerObj.label,
    models: MODELS.filter(m => m.provider === providerObj.value)
  })).filter(group => group.models.length > 0)

  const handleSelect = (newProvider: string, newModel: string) => {
    // Salvar no localStorage
    localStorage.setItem('lab-preferred-model', `${newProvider}:${newModel}`)
    
    // Callback
    onChange(newProvider, newModel)
    
    // Toast
    const selectedModel = MODELS.find(m => m.provider === newProvider && m.model === newModel)
    toast({
      title: 'Modelo alterado',
      description: `Agora usando ${selectedModel?.displayName || newModel}`,
    })
    
    setOpen(false)
  }

  return (
    <TooltipProvider>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium"
                aria-label="Selecionar modelo"
              >
                <span>{currentModel.icon}</span>
                <span>{currentModel.displayName}</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  open && "rotate-180"
                )} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="font-semibold">{currentModel.displayName}</div>
              {currentModel.capabilities && (
                <div className="text-xs space-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Aceita: </span>
                    {currentModel.capabilities.input.join(', ')}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Retorna: </span>
                    {currentModel.capabilities.output.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent className="w-[380px]" align="start">
          {modelsByProvider.map((group, groupIndex) => (
            <div key={group.provider}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                {group.providerLabel}
              </DropdownMenuLabel>
              {group.models.map((modelOption) => {
                const isSelected = provider === modelOption.provider && model === modelOption.model
                return (
                  <DropdownMenuItem
                    key={`${modelOption.provider}:${modelOption.model}`}
                    onClick={() => handleSelect(modelOption.provider, modelOption.model)}
                    className={cn(
                      "flex items-center gap-2 py-2",
                      isSelected && "bg-accent"
                    )}
                  >
                    <span className="flex-1 flex items-center gap-2 min-w-0">
                      <span>{modelOption.icon}</span>
                      <span className="flex-1 min-w-0">{modelOption.displayName}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {modelOption.capabilities && (
                        <ModelCapabilitiesBadge 
                          capabilities={modelOption.capabilities} 
                          size="sm"
                        />
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}

