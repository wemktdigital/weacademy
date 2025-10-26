import { createClient } from '@/lib/supabase'
import { callLLM } from './llmRouter'

export interface PipelineStep {
  order: number
  agent_id: string
}

export interface PipelineExecutionResult {
  agent_id: string
  output: string
  latency: number
  cost: number
}

export interface PipelineResult {
  results: PipelineExecutionResult[]
  totalLatency: number
  totalCost: number
}

export async function getPipelineById(pipelineId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('lab_agent_pipelines')
    .select('*')
    .eq('id', pipelineId)
    .single()

  if (error) throw new Error(`Pipeline not found: ${error.message}`)
  
  return data
}

export async function getAgentById(agentId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('lab_agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error) throw new Error(`Agent not found: ${error.message}`)
  
  return data
}

export async function runAgent(
  agentId: string,
  messages: any[],
  provider?: string,
  model?: string
) {
  const agent = await getAgentById(agentId)
  
  // Se o agente tem provider/modelo definidos, usar esses
  const finalProvider = provider || agent.provider || 'OpenAI'
  const finalModel = model || agent.model || 'gpt-4o-mini'
  
  // Adicionar prompt do agente como system message
  const systemPrompt = agent.prompt
  const messagesWithSystem = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages,
  ]

  // Executar LLM
  const startTime = Date.now()
  const result = await callLLM({
    provider: finalProvider,
    model: finalModel,
    messages: messagesWithSystem,
    stream: false,
  })
  const latency = Date.now() - startTime

  return {
    output: result.output,
    latency,
    cost: result.cost,
  }
}

export async function runPipeline(
  pipelineId: string,
  inputMessages: any[],
  userId: string
): Promise<PipelineResult> {
  const startTime = Date.now()
  
  // Buscar pipeline
  const pipeline = await getPipelineById(pipelineId)
  
  if (!pipeline.active) {
    throw new Error('Pipeline is inactive')
  }

  // Ordenar steps por ordem
  const steps: PipelineStep[] = pipeline.steps.sort((a: any, b: any) => a.order - b.order)

  if (steps.length === 0) {
    throw new Error('Pipeline has no steps')
  }

  let context = inputMessages
  const results: PipelineExecutionResult[] = []

  // Executar cada step sequencialmente
  for (const step of steps) {
    const { output, latency, cost } = await runAgent(step.agent_id, context)
    
    results.push({
      agent_id: step.agent_id,
      output,
      latency,
      cost,
    })
    
    // Passar output como contexto para o próximo agente
    context = [{ role: 'user', content: output }]
  }

  const totalLatency = Date.now() - startTime
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)

  // Salvar log da execução
  const supabase = await createClient()
  await supabase
    .from('lab_pipeline_logs')
    .insert({
      pipeline_id: pipelineId,
      user_id: userId,
      input_messages: inputMessages,
      output_messages: results.map(r => ({ output: r.output })),
      steps_executed: results.length,
      total_latency_ms: totalLatency,
      total_cost_usd: totalCost,
    })

  return {
    results,
    totalLatency,
    totalCost,
  }
}
