'use client'

import { useState } from 'react'
import { agents, Agent } from '@/modules/laboratorio-ia/agents'
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

interface AgentSelectorProps {
  selectedAgentId?: string
  onSelect: (agent: Agent | null) => void
}

export function AgentSelector({ selectedAgentId, onSelect }: AgentSelectorProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

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
          
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              className="p-2 cursor-pointer"
              onClick={() => handleSelect(agent)}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="text-2xl">{agent.icon}</div>
                <div className="flex-1">
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {agent.description}
                  </div>
                  <div className="text-xs text-primary mt-1">
                    {agent.type === 'local' ? 'Local' : 'Automação Externa'}
                  </div>
                </div>
                {selectedAgentId === agent.id && (
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
