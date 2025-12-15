'use client'

import { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Plus, Save, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Pipeline, PipelineStep } from '@/lib/validations/pipeline.schema'
import type { Agent } from '@/lib/validations/agent.schema'
import type { Condition } from '@/modules/laboratorio-ia/services/conditionEvaluator'
import { AgentNode } from './AgentNode'
import { ConditionConfigDialog } from './ConditionConfigDialog'
import { toast } from 'sonner'

const nodeTypes = {
  agent: AgentNode,
}

interface PipelineEditorProps {
  agents: Agent[]
  pipeline?: Pipeline
  onSave: (pipeline: Omit<Pipeline, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel: () => void
}

const initialPosition = { x: 250, y: 100 }
const nodeSpacing = { x: 300, y: 150 }

export function PipelineEditor({
  agents,
  pipeline,
  onSave,
  onCancel,
}: PipelineEditorProps) {
  const [name, setName] = useState(pipeline?.name || '')
  const [description, setDescription] = useState(pipeline?.description || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedAgent, setDraggedAgent] = useState<Agent | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [conditionDialogOpen, setConditionDialogOpen] = useState(false)
  const [editingCondition, setEditingCondition] = useState<{ condition: Condition | null, mergeStrategy?: 'concat' | 'first' | 'last' | 'longest' } | null>(null)

  // Converter pipeline existente para nodes e edges
  const initialNodes = useMemo(() => {
    if (!pipeline?.steps || pipeline.steps.length === 0) {
      return []
    }

    return pipeline.steps
      .sort((a, b) => a.order - b.order)
      .map((step, index) => {
        const agent = agents.find(a => a.id === step.agent_id)
        const position = {
          x: initialPosition.x + index * nodeSpacing.x,
          y: initialPosition.y + (index % 2) * nodeSpacing.y,
        }

        return {
          id: `agent-${step.agent_id}`,
          type: 'agent',
          position,
          data: {
            agent,
            label: agent?.name || 'Agente Desconhecido',
            icon: agent?.icon || '',
            stepOrder: step.order,
            condition: (step as any).condition,
            mergeStrategy: (step as any).merge_strategy,
          },
        } as Node
      })
  }, [pipeline, agents])

  const initialEdges = useMemo(() => {
    if (!pipeline?.steps || pipeline.steps.length < 2) {
      return []
    }

    const sortedSteps = [...pipeline.steps].sort((a, b) => a.order - b.order)
    const edges: Edge[] = []

    for (let i = 0; i < sortedSteps.length - 1; i++) {
      const currentStep = sortedSteps[i]
      const nextStep = sortedSteps[i + 1]

      // Criar edge entre steps consecutivos
      // Se têm mesma ordem, não criar edge (são branches condicionais)
      if (currentStep.order !== nextStep.order) {
        edges.push({
          id: `edge-${currentStep.order}-${nextStep.order}`,
          source: `agent-${currentStep.agent_id}`,
          target: `agent-${nextStep.agent_id}`,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style: {
            strokeWidth: 2,
          },
        })
      }
    }

    return edges
  }, [pipeline])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      // Validar se não há ciclos (edge já existe)
      const existingEdge = edges.find(
        e => e.source === params.source && e.target === params.target
      )
      if (existingEdge) {
        toast.error('Conexão já existe')
        return
      }

      setEdges((eds) => addEdge(params, eds))
    },
    [edges, setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const agentId = event.dataTransfer.getData('application/agent')
      if (!agentId) return

      const agent = agents.find(a => a.id === agentId)
      if (!agent) return

      // Verificar se já existe um node para este agente
      const existingNode = nodes.find(n => n.id === `agent-${agentId}`)
      if (existingNode) {
        toast.error('Agente já adicionado ao pipeline')
        return
      }

      const reactFlowBounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      if (!reactFlowBounds) return

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      // Determinar ordem baseada na posição no canvas ou quantidade de nodes
      const stepOrder = nodes.length + 1
      
      const newNode: Node = {
        id: `agent-${agentId}`,
        type: 'agent',
        position,
        data: {
          agent,
          label: agent.name || 'Agente Desconhecido',
          icon: agent.icon || '',
          stepOrder,
          condition: undefined,
          mergeStrategy: undefined,
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [agents, nodes, setNodes]
  )

  const onNodesDelete = useCallback((deleted: Node[]) => {
    // Remover edges conectados aos nodes deletados
    setEdges((eds) =>
      eds.filter(
        (e) =>
          !deleted.some((n) => n.id === e.source || n.id === e.target)
      )
    )

    // Renumerar steps
    const remainingNodes = nodes.filter(
      (n) => !deleted.some((d) => d.id === n.id)
    )
    const updatedNodes = remainingNodes.map((node, index) => ({
      ...node,
      data: {
        ...node.data,
        stepOrder: index + 1,
      },
    }))
    setNodes(updatedNodes)
  }, [nodes, setNodes, setEdges])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do pipeline é obrigatório')
      return
    }

    if (nodes.length === 0) {
      toast.error('Pipeline deve ter pelo menos um agente')
      return
    }

    // Converter nodes para steps ordenados por stepOrder
    const steps: PipelineStep[] = nodes
      .map((node) => ({
        order: node.data.stepOrder as number,
        agent_id: node.data.agent?.id || '',
        condition: node.data.condition,
        merge_strategy: node.data.mergeStrategy,
      }))
      .filter((step) => step.agent_id)
      .sort((a, b) => a.order - b.order)

    if (steps.length === 0) {
      toast.error('Nenhum agente válido encontrado')
      return
    }

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        steps,
        active: pipeline?.active ?? true,
        draft: pipeline?.draft ?? false,
      })
      toast.success('Pipeline salvo com sucesso!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar pipeline')
    }
  }

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents.filter(a => a.active)

    const query = searchQuery.toLowerCase()
    return agents.filter(
      (agent) =>
        agent.active &&
        (agent.name?.toLowerCase().includes(query) ||
          agent.description?.toLowerCase().includes(query) ||
          agent.category?.toLowerCase().includes(query))
    )
  }, [agents, searchQuery])

  const handleAgentDragStart = (event: React.DragEvent, agent: Agent) => {
    setDraggedAgent(agent)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/agent', agent.id || '')
  }

  const handleAgentDragEnd = () => {
    setDraggedAgent(null)
  }

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setEditingCondition({
      condition: node.data.condition || null,
      mergeStrategy: node.data.mergeStrategy,
    })
    setConditionDialogOpen(true)
  }, [])

  const handleConditionSave = useCallback((condition: Condition | null, mergeStrategy?: 'concat' | 'first' | 'last' | 'longest') => {
    if (!selectedNodeId) return

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              condition: condition || undefined,
              mergeStrategy: mergeStrategy || undefined,
            },
          }
        }
        return node
      })
    )
    setConditionDialogOpen(false)
    setEditingCondition(null)
    setSelectedNodeId(null)
  }, [selectedNodeId, setNodes])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Nome do Pipeline *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
            />
            <Input
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-md text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Pipeline
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Lista de Agentes */}
        <Card className="w-80 border-r rounded-none flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-3">Agentes Disponíveis</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar agentes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum agente encontrado
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <Card
                    key={agent.id}
                    className="p-3 cursor-grab active:cursor-grabbing hover:bg-muted transition-colors"
                    draggable
                    onDragStart={(e) => handleAgentDragStart(e, agent)}
                    onDragEnd={handleAgentDragEnd}
                    data-agent-id={agent.id}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{agent.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {agent.name}
                        </p>
                        {agent.category && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {agent.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Canvas - React Flow */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodesDelete={onNodesDelete}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted/30"
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'agent') return '#8b5cf6'
                return '#e5e7eb'
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>

          {/* Empty State */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-background/80 backdrop-blur-sm p-8 rounded-lg border">
                <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Comece a criar seu pipeline</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Arraste agentes da barra lateral para o canvas
                </p>
                <p className="text-xs text-muted-foreground">
                  Conecte os agentes clicando e arrastando das portas de saída
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Duplo clique em um agente para configurar condições condicionais
                </p>
              </div>
            </div>
          )}

          {/* Tooltip para nodes com condições */}
          {nodes.length > 0 && selectedNodeId && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg pointer-events-none z-10">
              <p className="text-xs text-muted-foreground">
                💡 Duplo clique para configurar condições condicionais
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog para configurar condições */}
      <ConditionConfigDialog
        open={conditionDialogOpen}
        onOpenChange={setConditionDialogOpen}
        condition={editingCondition?.condition || null}
        mergeStrategy={editingCondition?.mergeStrategy}
        onSave={handleConditionSave}
      />
    </div>
  )
}

