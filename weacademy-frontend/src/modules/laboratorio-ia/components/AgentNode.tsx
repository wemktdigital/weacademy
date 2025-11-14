'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import type { Agent } from '@/lib/validations/agent.schema'
import type { Condition } from '@/modules/laboratorio-ia/services/conditionEvaluator'

interface AgentNodeData {
  agent?: Agent
  label: string
  icon: string
  stepOrder: number
  condition?: Condition
  mergeStrategy?: 'concat' | 'first' | 'last' | 'longest'
}

export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const getConditionLabel = () => {
    if (!data.condition) return null
    
    const { type, value, operator } = data.condition
    const opLabel = operator === 'not_equals' ? 'não contém' 
      : operator === 'greater' ? '>'
      : operator === 'less' ? '<'
      : 'contém'
    
    if (type === 'contains') {
      return `se ${opLabel} "${value}"`
    } else if (type === 'length') {
      return `se length ${opLabel} ${value}`
    } else if (type === 'regex') {
      return `se match /${value}/`
    } else if (type === 'sentiment') {
      const sentimentLabels = { 0: 'negativo', 1: 'neutro', 2: 'positivo' }
      return `se sentimento ${opLabel} ${sentimentLabels[value as keyof typeof sentimentLabels] || value}`
    }
    
    return null
  }

  return (
    <Card className={`px-4 py-3 min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="secondary" className="shrink-0">
            #{data.stepOrder}
          </Badge>
          <span className="text-lg shrink-0">{data.icon}</span>
          <p className="font-medium text-sm truncate">{data.label}</p>
        </div>
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-primary"
        />
      </div>
      {data.condition && (
        <Badge variant="outline" className="text-xs mt-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500">
          ⚡ {getConditionLabel()}
        </Badge>
      )}
      {data.agent?.category && (
        <Badge variant="outline" className="text-xs mt-2">
          {data.agent.category}
        </Badge>
      )}
      {data.mergeStrategy && data.mergeStrategy !== 'concat' && (
        <Badge variant="outline" className="text-xs mt-2 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500">
          🔀 Merge: {data.mergeStrategy}
        </Badge>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-primary"
      />
    </Card>
  )
}

