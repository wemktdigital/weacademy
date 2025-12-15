'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, DollarSign, CheckCircle2, XCircle, Download, Copy } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface PipelineExecutionModalProps {
  execution: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PipelineExecutionModal({ execution, open, onOpenChange }: PipelineExecutionModalProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  const formatCost = (cost: number | string) => {
    const numCost = typeof cost === 'string' ? parseFloat(cost) : cost
    if (numCost === 0 || isNaN(numCost)) return 'Grátis'
    if (numCost < 0.01) return `$${(numCost * 1000).toFixed(2)} mil`
    return `$${numCost.toFixed(4)}`
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: 'Copiado!',
      description: 'Conteúdo copiado para a área de transferência',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(execution, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pipeline-execution-${execution.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportMarkdown = () => {
    let markdown = `# Execução de Pipeline\n\n`
    markdown += `**Pipeline:** ${execution.pipeline?.name || 'Desconhecido'}\n`
    markdown += `**Data:** ${new Date(execution.created_at).toLocaleString('pt-BR')}\n`
    markdown += `**Duração:** ${formatDuration(execution.total_latency_ms)}\n`
    markdown += `**Custo:** ${formatCost(execution.total_cost_usd)}\n`
    markdown += `**Etapas Executadas:** ${execution.steps_executed}\n\n`
    
    markdown += `## Input Inicial\n\n\`\`\`\n${JSON.stringify(execution.input_messages, null, 2)}\n\`\`\`\n\n`
    
    markdown += `## Outputs por Etapa\n\n`
    
    if (execution.output_messages && execution.output_messages.length > 0) {
      execution.output_messages.forEach((step: any, index: number) => {
        markdown += `### Etapa ${index + 1}`
        if (step.agent_id) markdown += ` (Agente: ${step.agent_id})`
        markdown += `\n\n`
        if (step.latency_ms) markdown += `- **Latência:** ${formatDuration(step.latency_ms)}\n`
        if (step.cost_usd) markdown += `- **Custo:** ${formatCost(step.cost_usd)}\n`
        markdown += `\n\`\`\`\n${step.output || 'Sem output'}\n\`\`\`\n\n`
      })
    }
    
    const dataBlob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pipeline-execution-${execution.id}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!execution) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {execution.pipeline?.name || 'Execução de Pipeline'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {new Date(execution.created_at).toLocaleString('pt-BR')}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportMarkdown}>
                <Download className="h-4 w-4 mr-2" />
                Markdown
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Métricas principais */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Duração</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">{formatDuration(execution.total_latency_ms)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Custo</p>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">{formatCost(execution.total_cost_usd)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Etapas</p>
              <p className="text-sm font-semibold">{execution.steps_executed}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge variant={execution.steps_executed === 0 ? 'destructive' : 'default'}>
                {execution.steps_executed === 0 ? (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Erro
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Sucesso
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Tabs com detalhes */}
          <Tabs defaultValue="steps" className="w-full">
            <TabsList>
              <TabsTrigger value="steps">Etapas</TabsTrigger>
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {execution.output_messages && execution.output_messages.length > 0 ? (
                    execution.output_messages.map((step: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Etapa {index + 1}</h4>
                          <div className="flex gap-2">
                            {step.latency_ms && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDuration(step.latency_ms)}
                              </Badge>
                            )}
                            {step.cost_usd && (
                              <Badge variant="secondary" className="text-xs">
                                <DollarSign className="h-3 w-3 mr-1" />
                                {formatCost(step.cost_usd)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {step.agent_id && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Agente: {step.agent_id}
                          </p>
                        )}
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mb-2"
                            onClick={() => handleCopy(step.output || '')}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar Output
                          </Button>
                          <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                            {step.output || 'Sem output'}
                          </pre>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma etapa executada
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="input" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-2"
                    onClick={() => handleCopy(JSON.stringify(execution.input_messages, null, 2))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar Input
                  </Button>
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    {JSON.stringify(execution.input_messages, null, 2)}
                  </pre>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="raw" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-2"
                    onClick={() => handleCopy(JSON.stringify(execution, null, 2))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar JSON Completo
                  </Button>
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    {JSON.stringify(execution, null, 2)}
                  </pre>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

