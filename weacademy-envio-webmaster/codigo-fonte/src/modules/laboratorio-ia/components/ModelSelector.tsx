'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'

const MODELS = AVAILABLE_MODELS

interface ModelSelectorProps {
  value?: string
  onChange: (provider: string, model: string) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { toast } = useToast()
  const [selectedValue, setSelectedValue] = useState(value || 'OpenAI:gpt-5-nano')

  useEffect(() => {
    // Carregar do localStorage
    const saved = localStorage.getItem('lab-preferred-model')
    if (saved) {
      setSelectedValue(saved)
      const [provider, model] = saved.split(':')
      onChange(provider, model)
    }
  }, [])

  // Sincronizar quando o valor controlado externo mudar (ex.: ao selecionar um agente)
  useEffect(() => {
    if (value && value !== selectedValue) {
      setSelectedValue(value)
    }
  }, [value])

  const handleChange = (newValue: string) => {
    setSelectedValue(newValue)
    const [provider, model] = newValue.split(':')
    
    // Salvar no localStorage
    localStorage.setItem('lab-preferred-model', newValue)
    
    // Atualizar no banco
    savePreference(provider, model)
    
    // Callback
    onChange(provider, model)
    
    // Toast
    const selectedModel = MODELS.find(m => `${m.provider}:${m.model}` === newValue)
    toast({
      title: 'Modelo alterado',
      description: `Agora usando ${selectedModel?.displayName || model}`,
    })
  }

  const savePreference = async (provider: string, model: string) => {
    try {
      // TODO: Implementar salvamento no Supabase
      // const { data: { user } } = await supabase.auth.getUser()
      // if (user) {
      //   await supabase.from('lab_user_settings').upsert({
      //     user_id: user.id,
      //     preferred_provider: provider,
      //     preferred_model: model,
      //   })
      // }
    } catch (error) {
      console.error('Erro ao salvar preferência:', error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        Modelo:
      </span>
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue>
            {(() => {
              const selectedModel = MODELS.find(
                m => `${m.provider}:${m.model}` === selectedValue
              )
              return selectedModel ? `${selectedModel.icon} ${selectedModel.displayName}` : selectedValue
            })()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MODELS.map((model) => (
            <SelectItem 
              key={`${model.provider}:${model.model}`} 
              value={`${model.provider}:${model.model}`}
            >
              <div className="flex items-center gap-2">
                <span>{model.icon}</span>
                <span>{model.displayName}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {model.provider}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
