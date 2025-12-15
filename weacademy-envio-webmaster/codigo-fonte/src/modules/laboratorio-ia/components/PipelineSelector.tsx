'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

interface Pipeline {
  id: string
  name: string
  description?: string
  steps: Array<{ order: number; agent_id: string }>
  active: boolean
}

interface PipelineSelectorProps {
  selectedPipelineId?: string
  onSelect: (pipeline: Pipeline | null) => void
}

export function PipelineSelector({ selectedPipelineId, onSelect }: PipelineSelectorProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPipelines = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/lab-ia/admin/pipelines?limit=100', {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        console.warn('[PipelineSelector] Erro ao buscar pipelines:', response.status, response.statusText)
        setPipelines([])
        return
      }

      const data = await response.json()
      // Filtrar apenas pipelines ativos
      const activePipelines = (data.pipelines || []).filter((p: Pipeline) => p.active)
      console.log('[PipelineSelector] Pipelines encontrados:', activePipelines.length)
      setPipelines(activePipelines)
    } catch (err) {
      console.error('[PipelineSelector] Error fetching pipelines:', err)
      setPipelines([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Buscar pipelines ao montar
    fetchPipelines()
  }, [])

  // Recarregar pipelines quando o dropdown abrir
  useEffect(() => {
    if (open) {
      fetchPipelines()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedPipeline = selectedPipelineId 
    ? pipelines.find(p => p.id === selectedPipelineId) 
    : null

  const handleSelect = (pipeline: Pipeline | null) => {
    onSelect(pipeline)
    setOpen(false)
    
    if (pipeline) {
      toast({
        title: 'Pipeline selecionado',
        description: `${pipeline.name} (${pipeline.steps?.length || 0} etapas)`,
      })
    } else {
      toast({
        title: 'Pipeline removido',
        description: 'Modo agente único',
      })
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {selectedPipeline ? (
            <>
              <span className="text-lg">🔗</span>
              <span className="hidden sm:inline">{selectedPipeline.name}</span>
            </>
          ) : (
            <>
              <span className="text-lg">🔗</span>
              <span className="hidden sm:inline">Pipelines</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[400px] p-2" align="start">
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex items-center justify-between">
            <span>Pipelines de Agentes</span>
            {selectedPipeline && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleSelect(null)}
              >
                Remover
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          <DropdownMenuItem
            key="none"
            className="p-2 cursor-pointer"
            onClick={() => handleSelect(null)}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="text-2xl">🤖</div>
              <div className="flex-1">
                <div className="font-medium">Agente Único</div>
                <div className="text-xs text-muted-foreground">
                  Use apenas um agente especializado
                </div>
              </div>
              {!selectedPipeline && (
                <div className="h-2 w-2 rounded-full bg-primary"></div>
              )}
            </div>
          </DropdownMenuItem>
          
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando pipelines...
            </div>
          ) : pipelines.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum pipeline disponível. Crie um em Admin → Pipelines.
            </div>
          ) : (
            pipelines.map((pipeline) => (
              <DropdownMenuItem
                key={pipeline.id}
                className="p-2 cursor-pointer"
                onClick={() => handleSelect(pipeline)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="text-2xl">🔗</div>
                  <div className="flex-1">
                    <div className="font-medium">{pipeline.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {pipeline.description || 'Sem descrição'}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {pipeline.steps?.length || 0} etapas
                      </Badge>
                    </div>
                  </div>
                  {selectedPipelineId === pipeline.id && (
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

