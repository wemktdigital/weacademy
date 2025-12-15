'use client'

import { useState, useEffect } from 'react'
import { Agent } from '@/lib/validations/agent.schema'
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
import { supabase } from '@/lib/supabase'

interface AgentSelectorProps {
  selectedAgentId?: string
  onSelect: (agent: Agent | null) => void
}

export function AgentSelector({ selectedAgentId, onSelect }: AgentSelectorProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAgents = async () => {
    setLoading(true)
    try {
      // Usar endpoint público que não requer autenticação admin
      const response = await fetch('/api/lab-ia/agents', {
        credentials: 'include',
        cache: 'no-store', // Evitar cache
      })

      if (!response.ok) {
        console.warn('[AgentSelector] Erro ao buscar agentes:', response.status, response.statusText)
        setAgents([])
        return
      }

      const data = await response.json()
      console.log('[AgentSelector] Agentes recebidos:', data.agents?.length || 0, data.agents)
      setAgents(data.agents || [])
    } catch (err) {
      console.error('[AgentSelector] Error fetching agents:', err)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Buscar agentes ao montar
    fetchAgents()
  }, [])

  // Recarregar agentes quando o dropdown abrir (para pegar atualizações)
  useEffect(() => {
    if (open) {
      fetchAgents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedAgent = selectedAgentId 
    ? agents.find(a => a.id === selectedAgentId) 
    : null

  const handleSelect = (agent: Agent | null) => {
    onSelect(agent)
    setOpen(false)
    
    if (agent) {
      toast({
        title: 'Agente selecionado',
        description: `${agent.icon} ${agent.name} ativo`,
      })
    } else {
      toast({
        title: 'Agente removido',
        description: 'Modo conversação padrão',
      })
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {selectedAgent ? (
            <>
              <span className="text-lg">{selectedAgent.icon}</span>
              <span className="hidden sm:inline">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <span className="text-lg">🤖</span>
              <span className="hidden sm:inline">Agentes</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[400px] p-2" align="start">
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex items-center justify-between">
            <span>Agentes Especializados</span>
            {selectedAgent && (
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
              <div className="text-2xl">💬</div>
              <div className="flex-1">
                <div className="font-medium">Modo Conversação</div>
                <div className="text-xs text-muted-foreground">
                  Chat padrão sem agente especializado
                </div>
              </div>
              {!selectedAgent && (
                <div className="h-2 w-2 rounded-full bg-primary"></div>
              )}
            </div>
          </DropdownMenuItem>
          
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando agentes...
            </div>
          ) : agents.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum agente disponível no momento
            </div>
          ) : (
            agents.map((agent) => (
              <DropdownMenuItem
                key={agent.id}
                className="p-2 cursor-pointer"
                onClick={() => handleSelect(agent)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="text-2xl flex-shrink-0">{agent.icon || '🤖'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.description || 'Sem descrição'}
                    </div>
                    {(agent as any).usage_instructions && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        📖 {(agent as any).usage_instructions}
                      </div>
                    )}
                    <div className="text-xs text-primary mt-1">
                      {agent.type === 'llm' ? 'Local' : 'Automação Externa'}
                    </div>
                  </div>
                  {selectedAgentId === agent.id && (
                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1"></div>
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
