import { callLLM } from './llmRouter'
import { createClient } from '@supabase/supabase-js'
import { evaluateCondition, mergeOutputs, type Condition } from './conditionEvaluator'
import { validateOutput, createSchemaFromDefinition, type ValidationResult } from './outputValidator'
import { 
  processPrompt, 
  processOutput, 
  buildVariableContext,
  type VariableContext,
  type TransformationConfig 
} from './variableProcessor'
import { searchKnowledgeBase, injectRAGContext } from './ragService'
import { getABVariant, recordABExecution, type ABExperiment } from './abTesting'
import { z } from 'zod'
import type { CollaborativeTeamConfig, TeamStrategy } from '../types/workflows'

export interface RetryConfig {
  maxTries?: number // Máximo de tentativas (default: 3)
  baseDelay?: number // Delay base em ms (default: 1000)
  maxDelay?: number // Delay máximo em ms (default: 10000)
  timeout?: number // Timeout por tentativa em ms (default: 30000)
  retryableErrors?: string[] // Tipos de erro que devem ter retry (network, timeout, rate-limit)
}

export interface PipelineStep {
  order: number
  agent_id: string
  condition?: Condition // Condição para executar esta etapa
  merge_strategy?: 'concat' | 'first' | 'last' | 'longest' // Como mergear outputs de múltiplos caminhos
  retry_config?: RetryConfig // Configuração de retry para este step
  timeout?: number // Timeout específico para este step
  fallback_agent_id?: string // Agente alternativo caso falhe
  strict_validation?: boolean // Se true, bloqueia execução se validação falhar (default: false)
  prompt_template?: string // Template do prompt com variáveis (sobrescreve prompt do agente se especificado)
  output_transform?: TransformationConfig[] // Transformações a aplicar no output
  variables?: Record<string, string | number | boolean> // Variáveis customizadas para este step
  supervisor?: {
    supervisorAgentId: string
    decisionStyle?: string
    autoApproveThreshold?: number | null
    allowOverride?: boolean
  }
}

export interface PipelineExecutionResult {
  agent_id: string
  output: string
  latency: number
  cost: number
  metadata?: Record<string, any>
}

export interface PipelineResult {
  results: PipelineExecutionResult[]
  totalLatency: number
  totalCost: number
}

type PipelineTeamProgress = {
  key: string
  name: string
  strategy: TeamStrategy
  phase?: 'execution' | 'validation' | 'decision'
  summary?: string
  status?: 'ok' | 'review' | 'conflict'
  votes?: Array<{
    option: number
    score: number
    agentId?: string
    agentName?: string
  }>
}

export interface PipelineProgressEvent {
  step: number
  totalSteps: number
  agentId: string
  agentName: string
  agentIcon?: string
  status: 'running' | 'completed' | 'error'
  output?: string
  latency?: number
  cost?: number
  metadata?: Record<string, any>
  team?: PipelineTeamProgress
}

export type ProgressCallback = (event: PipelineProgressEvent) => void

type TeamMemberRuntime = {
  agentId: string
  role: 'coordinator' | 'executor' | 'validator' | 'observer'
  weight: number
  responsibilities?: string
}

type TeamRuntime = {
  team: CollaborativeTeamConfig
  strategy: TeamStrategy
  executors: TeamMemberRuntime[]
  validators: TeamMemberRuntime[]
  coordinators: TeamMemberRuntime[]
  observers: TeamMemberRuntime[]
  roundRobinPointer: number
}

function buildTeamRuntime(team: CollaborativeTeamConfig | null | undefined): TeamRuntime | null {
  if (!team) return null
  const members = Array.isArray(team.members) ? team.members : []
  const normalizedMembers: TeamMemberRuntime[] = members
    .filter((member) => typeof member?.agentId === 'string' && member.agentId.trim().length > 0)
    .map((member) => ({
      agentId: member.agentId!,
      role: (member.role as TeamMemberRuntime['role']) || 'executor',
      weight: typeof member.weight === 'number' ? member.weight : 1,
      responsibilities: member.responsibilities,
    }))

  if (normalizedMembers.length === 0) {
    return null
  }

  return {
    team,
    strategy: team.strategy || 'round_robin',
    executors: normalizedMembers.filter((member) => member.role === 'executor'),
    validators: normalizedMembers.filter((member) => member.role === 'validator'),
    coordinators: normalizedMembers.filter((member) => member.role === 'coordinator'),
    observers: normalizedMembers.filter((member) => member.role === 'observer'),
    roundRobinPointer: 0,
  }
}

function takeNextExecutor(teamRuntime: TeamRuntime): TeamMemberRuntime | null {
  if (teamRuntime.executors.length === 0) return null
  const index = teamRuntime.roundRobinPointer % teamRuntime.executors.length
  const member = teamRuntime.executors[index]
  teamRuntime.roundRobinPointer = (teamRuntime.roundRobinPointer + 1) % teamRuntime.executors.length
  return member
}

function summarizeTeamOutputs(
  label: string,
  outputs: Array<{ member: TeamMemberRuntime; result: PipelineExecutionResult }>
): string {
  if (outputs.length === 0) return `${label} - nenhum resultado disponível.`
  const sections = outputs.map((entry, idx) => {
    const header = `${idx + 1}. ${entry.member.role.toUpperCase()} (${entry.member.agentId})`
    const responsibility = entry.member.responsibilities ? `\nResponsabilidade: ${entry.member.responsibilities}` : ''
    return `${header}${responsibility}\nResposta:\n${entry.result.output}`
  })
  return `${label}:\n${sections.join('\n\n')}`
}

function extractDecisionIndex(text: string): number | null {
  if (!text) return null
  const match = text.match(/(?:ESCOLHA|DECISAO|DECISÃO|OPCAO|OPÇÃO)\s*[:\-]?\s*(\d+)/i)
  if (match) {
    const idx = Number(match[1])
    if (Number.isFinite(idx)) {
      return idx - 1 // transformar em índice baseado em zero
    }
  }
  return null
}

function extractApprovalStatus(text: string): 'approved' | 'rejected' | 'pending' {
  if (!text) return 'pending'
  if (/\b(APROVADO|APPROVED|OK)\b/i.test(text)) return 'approved'
  if (/\b(REPROVADO|REJEITADO|REJECTED|NAO|NÃO)\b/i.test(text)) return 'rejected'
  return 'pending'
}

type SupervisorReviewResult = {
  decision: 'approved' | 'changes_requested' | 'escalate_human'
  summary?: string
  confidence?: number
  rawOutput: string
  metadata: Record<string, any>
}

type SupervisorReviewParams = {
  supervisorConfig: PipelineStep['supervisor']
  step: PipelineStep
  stepResult: PipelineExecutionResult
  collaborationSummary?: string
  branchContext: any[]
  stepVariableContext: Record<string, any>
  onProgress?: ProgressCallback
  totalSteps: number
  agentRunner?: (args: Parameters<typeof runAgentWithStepContext>[0]) => Promise<{
    stepResult: PipelineExecutionResult
    agentName: string
    agentIcon?: string
    progressEvents?: PipelineProgressEvent[]
    rawOutput: string
  }>
}

async function runSupervisorReview({
  supervisorConfig,
  step,
  stepResult,
  collaborationSummary,
  branchContext,
  stepVariableContext,
  onProgress,
  totalSteps,
  agentRunner,
}: SupervisorReviewParams): Promise<SupervisorReviewResult> {
  if (!supervisorConfig?.supervisorAgentId) {
    return {
      decision: 'approved',
      rawOutput: '',
      metadata: {},
    }
  }

  const summaryLines = [
    `Resumo da execução (agent_id=${stepResult.agent_id}):`,
    stepResult.output.substring(0, 1500),
  ]

  if (collaborationSummary) {
    summaryLines.push('\nContexto de colaboração:', collaborationSummary)
  }

  const reviewPrompt = `Você é o supervisor do pipeline. Analise o output abaixo, valide regras e decida:
- Se tudo estiver conforme, responda com "APROVADO" e um resumo curto.
- Se precisar de ajustes, comece com "ALTERAR" e explique o que deve ser corrigido.
- Se for necessário escalar para humano, use "ESCALAR" e descreva o motivo.

Considere limites de custo, compliance e qualidade.`

  const executeAgent =
    agentRunner ??
    ((args: Parameters<typeof runAgentWithStepContext>[0]) => runAgentWithStepContext(args))

  const execution = await executeAgent({
    agentId: supervisorConfig.supervisorAgentId,
    step,
    branchContext,
    stepVariableContext,
    onProgress,
    totalSteps,
    emitProgress: true,
    progressAgentId: supervisorConfig.supervisorAgentId,
    progressAgentName: 'Supervisor',
    progressAgentIcon: '🛡️',
    customMessages: [
      { role: 'system', content: reviewPrompt },
      { role: 'user', content: summaryLines.join('\n\n') },
    ],
    customSystemPrompt: reviewPrompt,
    applyOutputTransform: false,
    applyValidation: false,
  })

  const rawOutput = execution.rawOutput.trim()
  const upper = rawOutput.toUpperCase()

  let decision: SupervisorReviewResult['decision'] = 'approved'
  if (upper.startsWith('ESCALAR')) {
    decision = 'escalate_human'
  } else if (upper.startsWith('ALTERAR') || upper.startsWith('REJEIT') || upper.startsWith('NÃO') || upper.startsWith('NAO')) {
    decision = 'changes_requested'
  }

  const confidenceMatch = rawOutput.match(/CONFIDENCE\s*[:=]\s*(\d+(?:\.\d+)?)/i)
  const confidence = confidenceMatch ? Number(confidenceMatch[1]) : undefined

  return {
    decision,
    summary: rawOutput.substring(0, 500),
    confidence,
    rawOutput,
    metadata: {
      supervisorAgentId: supervisorConfig.supervisorAgentId,
      rawOutput,
      decision,
      confidence,
    },
  }
}

export const __test = {
  runSupervisorReview,
  getPipelineById,
}

// Circuit breaker simples para rastrear taxa de erro por agente
const circuitBreakerState = new Map<string, {
  failures: number
  lastFailure: number
  isOpen: boolean
}>()

const CIRCUIT_BREAKER_THRESHOLD = 5 // Após 5 falhas, abrir circuit
const CIRCUIT_BREAKER_RESET_TIME = 60000 // Reset após 60 segundos

/**
 * Verifica se o circuit breaker está aberto para um agente
 */
function isCircuitBreakerOpen(agentId: string): boolean {
  const state = circuitBreakerState.get(agentId)
  if (!state) return false
  
  if (state.isOpen) {
    // Verificar se passou tempo suficiente para resetar
    const timeSinceLastFailure = Date.now() - state.lastFailure
    if (timeSinceLastFailure > CIRCUIT_BREAKER_RESET_TIME) {
      // Resetar circuit breaker
      circuitBreakerState.set(agentId, { failures: 0, lastFailure: 0, isOpen: false })
      return false
    }
    return true
  }
  
  return false
}

/**
 * Registra uma falha para um agente (para circuit breaker)
 */
function recordFailure(agentId: string) {
  const state = circuitBreakerState.get(agentId) || { failures: 0, lastFailure: 0, isOpen: false }
  state.failures++
  state.lastFailure = Date.now()
  
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true
    console.log(`[CircuitBreaker] Circuit aberto para agente ${agentId} após ${state.failures} falhas`)
  }
  
  circuitBreakerState.set(agentId, state)
}

/**
 * Registra um sucesso para um agente (para circuit breaker)
 */
function recordSuccess(agentId: string) {
  const state = circuitBreakerState.get(agentId)
  if (state && state.failures > 0) {
    // Reduzir contador de falhas gradualmente
    state.failures = Math.max(0, state.failures - 1)
    if (state.failures === 0 && state.isOpen) {
      state.isOpen = false
      console.log(`[CircuitBreaker] Circuit fechado para agente ${agentId}`)
    }
    circuitBreakerState.set(agentId, state)
  }
}

/**
 * Verifica se um erro é retriável baseado na configuração
 */
function isRetryableError(error: any, retryConfig: RetryConfig): boolean {
  const errorMessage = error?.message?.toLowerCase() || ''
  const errorCode = error?.code?.toLowerCase() || ''
  
  // Se não há configuração específica, retry apenas em erros de rede/timeout/rate-limit
  const defaultRetryable = ['network', 'timeout', 'rate-limit', 'rate_limit', '429', '503', '502', '500']
  
  const retryablePatterns = retryConfig.retryableErrors || defaultRetryable
  
  return retryablePatterns.some(pattern => 
    errorMessage.includes(pattern.toLowerCase()) || 
    errorCode.includes(pattern.toLowerCase())
  )
}

/**
 * Calcula delay para retry com backoff exponencial
 */
function calculateRetryDelay(attempt: number, retryConfig: RetryConfig): number {
  const baseDelay = retryConfig.baseDelay || 1000
  const maxDelay = retryConfig.maxDelay || 10000
  
  // Backoff exponencial: baseDelay * 2^(attempt - 1)
  const delay = baseDelay * Math.pow(2, attempt - 1)
  
  return Math.min(delay, maxDelay)
}

/**
 * Executa uma função com timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ])
}

export async function getPipelineById(pipelineId: string) {
  // Usar service role para bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data, error } = await supabase
    .from('lab_agent_pipelines')
    .select('*')
    .eq('id', pipelineId)
    .single()

  if (error) throw new Error(`Pipeline not found: ${error.message}`)
  
  return data
}

export async function getAgentById(agentId: string) {
  // Usar service role para bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data, error } = await supabase
    .from('lab_agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error) throw new Error(`Agent not found: ${error.message}`)
  
  return data
}

const agentCache = new Map<string, Awaited<ReturnType<typeof getAgentById>>>()

async function getAgentCached(agentId: string) {
  if (agentCache.has(agentId)) {
    return agentCache.get(agentId)!
  }
  const agent = await getAgentById(agentId)
  agentCache.set(agentId, agent)
  return agent
}

export async function runAgent(
  agentId: string,
  messages: any[],
  provider?: string,
  model?: string,
  retryConfig?: RetryConfig,
  timeout?: number
): Promise<{ output: string; latency: number; cost: number }> {
  // Verificar circuit breaker
  if (isCircuitBreakerOpen(agentId)) {
    throw new Error(`Circuit breaker está aberto para agente ${agentId}. Muitas falhas recentes.`)
  }
  
  const agent = await getAgentById(agentId)
  
  // Se o agente tem provider/modelo definidos, usar esses
  const finalProvider = provider || agent.provider || 'OpenAI'
  const finalModel = model || agent.model || 'gpt-4o-mini'
  
  // Adicionar prompt do agente como system message
  let systemPrompt = agent.prompt || ''
  
  // Integrar RAG se o agente tem knowledge_base_files configurado
  if (agent.knowledge_base_files && agent.knowledge_base_files.length > 0) {
    try {
      // Buscar contexto relevante da knowledge base
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()
      const query = lastUserMessage?.content || messages[messages.length - 1]?.content || ''
      
      if (query) {
        const ragContext = await searchKnowledgeBase(query, {
          agentId: agentId,
          similarityThreshold: 0.7,
          maxResults: 5,
        })
        
        if (ragContext.chunks.length > 0) {
          // Injeta contexto RAG no prompt
          systemPrompt = injectRAGContext(systemPrompt, ragContext)
          console.log(`[runAgent] RAG: injetou ${ragContext.chunks.length} chunks no prompt do agente ${agentId}`)
        }
      }
    } catch (ragError: any) {
      console.warn(`[runAgent] Erro ao buscar contexto RAG para agente ${agentId}:`, ragError.message)
      // Continuar sem RAG se houver erro
    }
  }
  
  const messagesWithSystem = [
    ...(systemPrompt ? [{ role: 'system', content: String(systemPrompt || '') }] : []),
    // Filtrar e validar mensagens - garantir que content seja sempre string válida
    ...messages
      .filter(msg => msg && msg.content !== null && msg.content !== undefined)
      .map(msg => ({
        role: msg.role || 'user',
        content: String(msg.content || ''),
      })),
  ]

  // Garantir que há pelo menos uma mensagem válida
  if (messagesWithSystem.length === 0) {
    throw new Error('Nenhuma mensagem válida para enviar ao agente')
  }

  // Configurações de retry padrão se não especificadas
  const defaultRetryConfig: RetryConfig = {
    maxTries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    timeout: 30000,
    retryableErrors: ['network', 'timeout', 'rate-limit', 'rate_limit', '429', '503', '502'],
  }
  
  const finalRetryConfig = retryConfig || defaultRetryConfig
  const finalTimeout = timeout || finalRetryConfig.timeout || 30000
  
  // Executar com retry
  const maxTries = finalRetryConfig.maxTries || 3
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      console.log(`[runAgent] Tentativa ${attempt}/${maxTries} - Executando LLM: provider=${finalProvider}, model=${finalModel}`)
      const startTime = Date.now()
      
      // Executar LLM com timeout
      const llmPromise = callLLM({
        provider: finalProvider,
        model: finalModel,
        messages: messagesWithSystem,
        stream: false,
      })
      
      const result = await withTimeout(
        llmPromise,
        finalTimeout,
        `Timeout após ${finalTimeout}ms na tentativa ${attempt}`
      )
      
      const latency = Date.now() - startTime

      console.log(`[runAgent] Sucesso na tentativa ${attempt}:`, {
        outputType: typeof result.content,
        outputLength: result.content?.length,
        outputPreview: result.content?.substring(0, 150),
      })

      // Garantir que output seja sempre uma string válida
      const safeOutput = result.content ? String(result.content) : '[Resposta vazia do agente]'
      
      // Registrar sucesso no circuit breaker
      recordSuccess(agentId)

      return {
        output: safeOutput,
        latency,
        cost: result.cost,
      }
    } catch (error: any) {
      lastError = error
      console.error(`[runAgent] Erro na tentativa ${attempt}/${maxTries}:`, {
        error: error.message,
        code: error.code,
      })
      
      // Verificar se é retriável
      if (attempt < maxTries && isRetryableError(error, finalRetryConfig)) {
        const delay = calculateRetryDelay(attempt, finalRetryConfig)
        console.log(`[runAgent] Aguardando ${delay}ms antes de retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue // Tentar novamente
      } else {
        // Não é retriável ou esgotou tentativas
        if (attempt === maxTries) {
          // Registrar falha no circuit breaker
          recordFailure(agentId)
        }
        throw error // Re-lançar erro
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  recordFailure(agentId)
  throw lastError || new Error('Todas as tentativas falharam')
}

type AgentExecutionPayload = {
  agentId: string
  step: PipelineStep
  branchContext: any[]
  stepVariableContext: Record<string, any>
  onProgress?: ProgressCallback
  totalSteps: number
  emitProgress?: boolean
  progressAgentId?: string
  progressAgentName?: string
  progressAgentIcon?: string
  customMessages?: any[]
  customSystemPrompt?: string
  applyOutputTransform?: boolean
  applyValidation?: boolean
  overrideRetryConfig?: RetryConfig
  overrideTimeout?: number
  progressMetadata?: Record<string, any>
  progressTeam?: PipelineProgressEvent['team']
}

async function runAgentWithStepContext({
  agentId,
  step,
  branchContext,
  stepVariableContext,
  onProgress,
  totalSteps,
  emitProgress = true,
  progressAgentId,
  progressAgentName,
  progressAgentIcon,
  customMessages,
  customSystemPrompt,
  applyOutputTransform = true,
  applyValidation = true,
  overrideRetryConfig,
  overrideTimeout,
  progressMetadata,
  progressTeam,
}: AgentExecutionPayload): Promise<{
  stepResult: PipelineExecutionResult
  agentName: string
  agentIcon: string
  rawOutput: string
}> {
  const agent = await getAgentCached(agentId)
  const agentName = progressAgentName || agent.name || 'Agente Desconhecido'
  const agentIcon = progressAgentIcon || agent.icon || ''

  let processedPrompt = ''
  let messagesForAgent: any[] = branchContext

  if (customMessages) {
    messagesForAgent = customMessages
    processedPrompt = customSystemPrompt || ''
  } else {
    if (step.prompt_template) {
      processedPrompt = processPrompt(step.prompt_template, stepVariableContext)
    } else if (agent.prompt) {
      processedPrompt = processPrompt(agent.prompt, stepVariableContext)
    }

    if (agent.knowledge_base_files && agent.knowledge_base_files.length > 0) {
      try {
        const lastUserMessage = branchContext.filter((m: any) => m.role === 'user').pop()
        const query = lastUserMessage?.content || branchContext[branchContext.length - 1]?.content || ''

        if (query) {
          const ragContext = await searchKnowledgeBase(query, {
            agentId,
            similarityThreshold: 0.7,
            maxResults: 5,
          })

          if (ragContext.chunks.length > 0) {
            processedPrompt = injectRAGContext(processedPrompt, ragContext)
            console.log(
              `[PipelineRunner] RAG: injetou ${ragContext.chunks.length} chunks no prompt do agente ${agentId}`
            )
          }
        }
      } catch (ragError: any) {
        console.warn(
          `[PipelineRunner] Erro ao buscar contexto RAG para agente ${agentId}:`,
          ragError.message
        )
      }
    }
  }

  const messagesWithPrompt = [
    ...(processedPrompt ? [{ role: 'system', content: processedPrompt }] : []),
    ...messagesForAgent,
  ]

  const progressId = progressAgentId || agentId

  if (emitProgress && onProgress) {
    onProgress({
      step: step.order,
      totalSteps,
      agentId: progressId,
      agentName,
      agentIcon,
      status: 'running',
      metadata: progressMetadata,
      team: progressTeam,
    })
  }

  const { output, latency, cost } = await runAgent(
    agentId,
    messagesWithPrompt,
    undefined,
    undefined,
    overrideRetryConfig || step.retry_config,
    overrideTimeout || step.timeout
  )

  let safeOutput = output || '[Sem resposta do agente]'

  if (applyOutputTransform && step.output_transform && step.output_transform.length > 0) {
    safeOutput = processOutput(safeOutput, step.output_transform, stepVariableContext)
  }

  if (applyValidation && agent.output_schema) {
    try {
      const outputSchema = createSchemaFromDefinition(agent.output_schema)
      if (outputSchema) {
        const validationResult = validateOutput(safeOutput, outputSchema)
        if (!validationResult.isValid && step.strict_validation) {
          const errorMessage =
            validationResult.suggestions?.join('; ') ||
            validationResult.errors?.errors.map((err) => err.message).join('; ') ||
            'Validação falhou'
          throw new Error(
            `Validação falhou para step ${step.order} (agente ${agentId}): ${errorMessage}`
          )
        }
      }
    } catch (validationError) {
      console.error(
        `[PipelineRunner] Erro ao validar output do step ${step.order}:`,
        validationError
      )
    }
  }

  if (emitProgress && onProgress) {
    onProgress({
      step: step.order,
      totalSteps,
      agentId: progressId,
      agentName,
      agentIcon,
      status: 'completed',
      output: safeOutput.substring(0, 200),
      latency,
      cost,
      metadata: progressMetadata,
      team: progressTeam,
    })
  }

  return {
    stepResult: {
      agent_id: agentId,
      output: safeOutput,
      latency,
      cost,
    },
    agentName,
    agentIcon,
    rawOutput: safeOutput,
  }
}

type CollaborativeExecutionParams = {
  teamRuntime: TeamRuntime
  step: PipelineStep
  branchContext: any[]
  stepVariableContext: Record<string, any>
  onProgress?: ProgressCallback
  totalSteps: number
}

async function executeCollaborativeTeamStep({
  teamRuntime,
  step,
  branchContext,
  stepVariableContext,
  onProgress,
  totalSteps,
}: CollaborativeExecutionParams): Promise<{
  success: boolean
  stepResult?: PipelineExecutionResult
  agentName?: string
  agentIcon?: string
  metadata?: Record<string, any>
  error?: Error
}> {
  try {
    const teamAgentId = `team:${teamRuntime.team.teamKey}`
    const teamAgentName = `Equipe ${teamRuntime.team.name}`
    const teamIcon = '👥'

    const emitTeamProgress = (
      status: PipelineProgressEvent['status'],
      info: {
        phase?: PipelineTeamProgress['phase']
        summary?: string
        teamStatus?: PipelineTeamProgress['status']
        output?: string
        votes?: PipelineTeamProgress['votes']
      } = {}
    ) => {
      if (!onProgress) return
      onProgress({
        step: step.order,
        totalSteps,
        agentId: teamAgentId,
        agentName: teamAgentName,
        agentIcon: teamIcon,
        status,
        output: info.output,
        metadata: { phase: info.phase, summary: info.summary },
        team: {
          key: teamRuntime.team.teamKey,
          name: teamRuntime.team.name,
          strategy: teamRuntime.strategy,
          phase: info.phase,
          summary: info.summary,
          status: info.teamStatus,
          votes: info.votes,
        },
      })
    }

    const executorsLabel =
      teamRuntime.executors.length > 0
        ? teamRuntime.executors.map((member) => member.agentId).join(', ')
        : teamRuntime.coordinators.map((member) => member.agentId).join(', ')

    emitTeamProgress('running', {
      phase: 'execution',
      summary: `Executores ativos: ${executorsLabel || 'não configurado'}`,
    })

    if (teamRuntime.strategy === 'round_robin') {
      const executor =
        takeNextExecutor(teamRuntime) ||
        teamRuntime.executors[0] ||
        teamRuntime.coordinators[0] ||
        null
      if (!executor) {
        throw new Error('Nenhum executor disponível no time colaborativo.')
      }
      const execution = await runAgentWithStepContext({
        agentId: executor.agentId,
        step,
        branchContext,
        stepVariableContext,
        onProgress,
        totalSteps,
        emitProgress: false,
      })
      execution.stepResult.metadata = {
        teamKey: teamRuntime.team.teamKey,
        teamName: teamRuntime.team.name,
        strategy: teamRuntime.strategy,
        role: executor.role,
      }
      emitTeamProgress('completed', {
        phase: 'decision',
        summary: `Rodízio executado por ${executor.agentId}.`,
        output: execution.rawOutput.substring(0, 200),
      })
      return {
        success: true,
        stepResult: execution.stepResult,
        agentName: `${execution.agentName} · ${teamRuntime.team.name}`,
        agentIcon: execution.agentIcon,
        metadata: execution.stepResult.metadata,
      }
    }

    const executors = teamRuntime.executors.length > 0 ? teamRuntime.executors : teamRuntime.coordinators
    if (!executors || executors.length === 0) {
      throw new Error('Time colaborativo sem executores/coordenadores configurados.')
    }

    const executorOutputs: Array<{
      member: TeamMemberRuntime
      execution: Awaited<ReturnType<typeof runAgentWithStepContext>>
    }> = []

    for (const member of executors) {
      const execution = await runAgentWithStepContext({
        agentId: member.agentId,
        step,
        branchContext,
        stepVariableContext,
        onProgress,
        totalSteps,
        emitProgress: false,
      })
      executorOutputs.push({ member, execution })
    }

    const validatorsOutputs: Array<{
      member: TeamMemberRuntime
      execution: Awaited<ReturnType<typeof runAgentWithStepContext>>
      decisionIndex: number | null
      approvalStatus: 'approved' | 'rejected' | 'pending'
    }> = []

    const formattedExecutorSummary = executorOutputs
      .map((entry, idx) => {
        return `${idx + 1}. ${entry.execution.agentName || entry.member.agentId}\n${entry.execution.rawOutput}`
      })
      .join('\n\n')

    if (teamRuntime.validators.length > 0) {
      emitTeamProgress('running', {
        phase: 'validation',
        summary: `Validadores avaliando: ${teamRuntime.validators
          .map((member) => member.agentId)
          .join(', ')}`,
      })
      for (const validator of teamRuntime.validators) {
        const validatorPrompt =
          teamRuntime.strategy === 'majority_vote'
            ? `Analise as respostas fornecidas pelos executores do time ${teamRuntime.team.name} (listadas abaixo). Escolha a melhor resposta indicando "DECISAO: <número>" e explique em seguida.\n\n${formattedExecutorSummary}`
            : `Você é validador da equipe ${teamRuntime.team.name}. Revise as respostas listadas abaixo e forneça observações e um veredito opcional usando "STATUS: APROVADO" ou "STATUS: REJEITADO".\n\n${formattedExecutorSummary}`

        const execution = await runAgentWithStepContext({
          agentId: validator.agentId,
          step,
          branchContext,
          stepVariableContext,
          onProgress,
          totalSteps,
          emitProgress: false,
          customMessages: [{ role: 'user', content: validatorPrompt }],
          customSystemPrompt: `Você atua como validador do time ${teamRuntime.team.name}. Seja objetivo.`,
          applyOutputTransform: false,
          applyValidation: false,
        })

        validatorsOutputs.push({
          member: validator,
          execution,
          decisionIndex: extractDecisionIndex(execution.rawOutput),
          approvalStatus: extractApprovalStatus(execution.rawOutput),
        })
      }
    }

    const metadata: Record<string, any> = {
      teamKey: teamRuntime.team.teamKey,
      teamName: teamRuntime.team.name,
      strategy: teamRuntime.strategy,
      executors: executorOutputs.map((entry, idx) => ({
        index: idx,
        agentId: entry.member.agentId,
        role: entry.member.role,
        outputPreview: entry.execution.rawOutput.substring(0, 200),
      })),
      validators: validatorsOutputs.map((entry) => ({
        agentId: entry.member.agentId,
        role: entry.member.role,
        decisionIndex: entry.decisionIndex,
        approvalStatus: entry.approvalStatus,
      })),
    }

    const sumCosts = (...results: PipelineExecutionResult[]) =>
      results.reduce((acc, item) => acc + (item?.cost || 0), 0)
    const sumLatency = (...results: PipelineExecutionResult[]) =>
      results.reduce((acc, item) => acc + (item?.latency || 0), 0)

    switch (teamRuntime.strategy) {
      case 'parallel_debate':
      case 'consensus':
      case 'coordinator_override': {
        const coordinator =
          teamRuntime.coordinators[0] || (teamRuntime.strategy === 'coordinator_override' ? executors[0] : null)

        const validatorsNotes = validatorsOutputs
          .map((entry, idx) => `Validador ${idx + 1} (${entry.execution.agentName}): ${entry.execution.rawOutput}`)
          .join('\n\n')

        let finalResult: PipelineExecutionResult
        let finalAgentName = ''
        let finalAgentIcon = ''

        if (coordinator) {
          const coordinatorInstruction = (() => {
            if (teamRuntime.strategy === 'coordinator_override') {
              return `Escolha uma das respostas abaixo ou construa uma nova síntese, justificando suas decisões.`
            }
            if (teamRuntime.strategy === 'consensus') {
              return `Construa uma resposta consensual incorporando os melhores pontos das contribuições e considerando as avaliações. Se detectar divergências, explique-as e indique próximos passos.`
            }
            return `Analise o debate dos executores e produza uma resposta final clara. Considere sugestões dos validadores quando relevantes.`
          })()

          const coordinatorMessage = `Respostas dos executores:

${formattedExecutorSummary}

Feedback dos validadores:

${validatorsNotes || 'Nenhum feedback fornecido.'}

Instruções: ${coordinatorInstruction}`

          const coordinatorExecution = await runAgentWithStepContext({
            agentId: coordinator.agentId,
            step,
            branchContext,
            stepVariableContext,
            onProgress,
            totalSteps,
            emitProgress: true,
            customMessages: [{ role: 'user', content: coordinatorMessage }],
            customSystemPrompt: `Você coordena o time ${teamRuntime.team.name}. Gere a melhor resposta final e cite, quando apropriado, quem contribuiu com cada ponto-chave.`,
            applyOutputTransform: false,
            applyValidation: false,
            progressTeam: {
              key: teamRuntime.team.teamKey,
              name: teamRuntime.team.name,
              strategy: teamRuntime.strategy,
              phase: 'decision',
            },
            progressMetadata: {
              collaboration: true,
              strategy: teamRuntime.strategy,
            },
          })

          const combinedCost = sumCosts(
            coordinatorExecution.stepResult,
            ...executorOutputs.map((entry) => entry.execution.stepResult),
            ...validatorsOutputs.map((entry) => entry.execution.stepResult)
          )
          const combinedLatency = sumLatency(
            coordinatorExecution.stepResult,
            ...executorOutputs.map((entry) => entry.execution.stepResult),
            ...validatorsOutputs.map((entry) => entry.execution.stepResult)
          )

          finalResult = {
            agent_id: coordinatorExecution.stepResult.agent_id,
            output: `${coordinatorExecution.stepResult.output}\n\n---\nResumo das contribuições:\n${formattedExecutorSummary}\n\nFeedback dos validadores:\n${validatorsNotes || 'Nenhum feedback registrado.'}`,
            cost: combinedCost,
            latency: combinedLatency,
            metadata,
          }
          finalAgentName = `${coordinatorExecution.agentName} · ${teamRuntime.team.name}`
          finalAgentIcon = coordinatorExecution.agentIcon
          emitTeamProgress('completed', {
            phase: 'decision',
            summary: `Coordenador ${coordinator.agentId} consolidou resposta.`,
            output: finalResult.output.substring(0, 200),
            teamStatus: metadata.consensusStatus === 'review' ? 'review' : 'ok',
          })
        } else {
          const primary = executorOutputs[0]
          if (!primary) {
            throw new Error('Não há executores suficientes para coordenar a resposta.')
          }
          const combinedCost = sumCosts(
            primary.execution.stepResult,
            ...executorOutputs.slice(1).map((entry) => entry.execution.stepResult),
            ...validatorsOutputs.map((entry) => entry.execution.stepResult)
          )
          const combinedLatency = sumLatency(
            primary.execution.stepResult,
            ...executorOutputs.slice(1).map((entry) => entry.execution.stepResult),
            ...validatorsOutputs.map((entry) => entry.execution.stepResult)
          )

          const finalOutput = `${primary.execution.stepResult.output}\n\n---\nContribuições adicionais:\n${formattedExecutorSummary}\n\nFeedback dos validadores:\n${validatorsNotes || 'Nenhum feedback registrado.'}`

          if (onProgress) {
            onProgress({
              step: step.order,
              totalSteps,
              agentId: primary.execution.stepResult.agent_id,
              agentName: `${primary.execution.agentName} · ${teamRuntime.team.name}`,
              agentIcon: primary.execution.agentIcon,
              status: 'running',
            })
            onProgress({
              step: step.order,
              totalSteps,
              agentId: primary.execution.stepResult.agent_id,
              agentName: `${primary.execution.agentName} · ${teamRuntime.team.name}`,
              agentIcon: primary.execution.agentIcon,
              status: 'completed',
              output: finalOutput.substring(0, 200),
              latency: combinedLatency,
              cost: combinedCost,
            })
          }

          finalResult = {
            agent_id: primary.execution.stepResult.agent_id,
            output: finalOutput,
            cost: combinedCost,
            latency: combinedLatency,
            metadata,
          }
          finalAgentName = `${primary.execution.agentName} · ${teamRuntime.team.name}`
          finalAgentIcon = primary.execution.agentIcon
          emitTeamProgress('completed', {
            phase: 'decision',
            summary: 'Resposta principal selecionada após debate.',
            output: finalResult.output.substring(0, 200),
            teamStatus: metadata.consensusStatus === 'review' ? 'review' : 'ok',
          })
        }

        // Para consenso, registrar se todos aprovaram
        if (teamRuntime.strategy === 'consensus') {
          metadata.consensusStatus = validatorsOutputs.every((v) => v.approvalStatus !== 'rejected')
            ? 'approved'
            : 'review'
        }

        return {
          success: true,
          stepResult: finalResult,
          agentName: finalAgentName,
          agentIcon: finalAgentIcon,
          metadata,
        }
      }

      case 'majority_vote': {
        const votes = new Map<number, number>()
        const voteDetails: string[] = []

        validatorsOutputs.forEach((entry, idx) => {
          if (entry.decisionIndex != null && executorOutputs[entry.decisionIndex]) {
            const weight = entry.member.weight || 1
            votes.set(entry.decisionIndex, (votes.get(entry.decisionIndex) || 0) + weight)
            voteDetails.push(
              `Validador ${idx + 1} (${entry.execution.agentName}) votou no item ${
                entry.decisionIndex + 1
              } (peso ${weight}).`
            )
          } else {
            voteDetails.push(
              `Validador ${idx + 1} (${entry.execution.agentName}) não registrou voto claro.`
            )
          }
        })

        let winnerIndex = 0
        let bestScore = -Infinity
        votes.forEach((score, idx) => {
          if (score > bestScore) {
            bestScore = score
            winnerIndex = idx
          }
        })

        const winningExecutor = executorOutputs[winnerIndex] || executorOutputs[0]
        const combinedCost = sumCosts(
          winningExecutor.execution.stepResult,
          ...executorOutputs
            .filter((entry) => entry !== winningExecutor)
            .map((entry) => entry.execution.stepResult),
          ...validatorsOutputs.map((entry) => entry.execution.stepResult)
        )
        const combinedLatency = sumLatency(
          winningExecutor.execution.stepResult,
          ...executorOutputs
            .filter((entry) => entry !== winningExecutor)
            .map((entry) => entry.execution.stepResult),
          ...validatorsOutputs.map((entry) => entry.execution.stepResult)
        )

        const finalOutput = `${winningExecutor.execution.stepResult.output}\n\n---\nResumo dos votos:\n${
          voteDetails.join('\n') || 'Sem votos registrados.'
        }\n\nContribuições:
\n${formattedExecutorSummary}`

        if (onProgress) {
          onProgress({
            step: step.order,
            totalSteps,
            agentId: winningExecutor.execution.stepResult.agent_id,
            agentName: `${winningExecutor.execution.agentName} · ${teamRuntime.team.name}`,
            agentIcon: winningExecutor.execution.agentIcon,
            status: 'running',
          })
          onProgress({
            step: step.order,
            totalSteps,
            agentId: winningExecutor.execution.stepResult.agent_id,
            agentName: `${winningExecutor.execution.agentName} · ${teamRuntime.team.name}`,
            agentIcon: winningExecutor.execution.agentIcon,
            status: 'completed',
            output: finalOutput.substring(0, 200),
            latency: combinedLatency,
            cost: combinedCost,
          })
        }

        const finalResult: PipelineExecutionResult = {
          agent_id: winningExecutor.execution.stepResult.agent_id,
          output: finalOutput,
          cost: combinedCost,
          latency: combinedLatency,
          metadata: {
            ...metadata,
            decision: {
              winnerIndex,
              winningAgentId: winningExecutor.member.agentId,
              score: bestScore,
              votes: Array.from(votes.entries()).map(([idx, score]) => ({
                option: idx,
                score,
              })),
            },
          },
        }

        emitTeamProgress('completed', {
          phase: 'decision',
          summary: `Voto por maioria escolheu opção ${winnerIndex + 1}.`,
          output: finalOutput.substring(0, 200),
          teamStatus:
            validatorsOutputs.some((entry) => entry.approvalStatus === 'rejected') || votes.size === 0
              ? 'review'
              : 'ok',
          votes: finalResult.metadata?.decision?.votes?.map((vote) => ({
            option: vote.option,
            score: vote.score,
          })),
        })

        return {
          success: true,
          stepResult: finalResult,
          agentName: `${winningExecutor.execution.agentName} · ${teamRuntime.team.name}`,
          agentIcon: winningExecutor.execution.agentIcon,
          metadata: finalResult.metadata,
        }
      }

      default:
        throw new Error(`Estratégia de colaboração não suportada: ${teamRuntime.strategy}`)
    }
  } catch (error: any) {
    if (onProgress) {
      onProgress({
        step: step.order,
        totalSteps,
        agentId: `team:${teamRuntime.team.teamKey}`,
        agentName: `Equipe ${teamRuntime.team.name}`,
        agentIcon: '👥',
        status: 'error',
        output: error?.message,
        team: {
          key: teamRuntime.team.teamKey,
          name: teamRuntime.team.name,
          strategy: teamRuntime.strategy,
          phase: 'decision',
          summary: error?.message,
          status: 'conflict',
        },
      })
    }
    return {
      success: false,
      error,
    }
  }
}

export async function runPipeline(
  pipelineId: string,
  inputMessages: any[],
  userId: string,
  onProgress?: ProgressCallback,
  allowDraft: boolean = false,
  options?: {
    abExperimentId?: string
    sessionId?: string
    collaboration?: {
      team: CollaborativeTeamConfig
    }
  }
): Promise<PipelineResult> {
  const startTime = Date.now()
  
  // Verificar se há experimento A/B ativo para este pipeline
  let actualPipelineId = pipelineId
  let abExperiment: ABExperiment | null = null
  let abVariant: 'a' | 'b' | null = null
  
  if (options?.abExperimentId) {
    try {
      const { getABExperiment } = await import('./abTesting')
      abExperiment = await getABExperiment(options.abExperimentId)
      
      if (abExperiment && abExperiment.status === 'running') {
        // Determinar variante
        abVariant = await getABVariant(options.abExperimentId, userId, options.sessionId)
        
        // Selecionar pipeline correto baseado na variante
        actualPipelineId = abVariant === 'a' 
          ? abExperiment.variant_a_pipeline_id
          : abExperiment.variant_b_pipeline_id
        
        // Se há versão específica, usar versão (implementar depois)
        // Por enquanto, usar pipeline diretamente
      }
    } catch (error) {
      console.warn('[PipelineRunner] Erro ao verificar experimento A/B:', error)
      // Continuar com pipeline original se houver erro
    }
  } else {
    // Verificar se há experimento A/B ativo que inclua este pipeline
    try {
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const { data: experiments } = await serviceSupabase
        .from('lab_pipeline_ab_experiments')
        .select('*')
        .eq('status', 'running')
        .or(`variant_a_pipeline_id.eq.${pipelineId},variant_b_pipeline_id.eq.${pipelineId}`)
        .limit(1)
      
      if (experiments && experiments.length > 0) {
        abExperiment = experiments[0] as ABExperiment
        abVariant = await getABVariant(abExperiment.id, userId, options?.sessionId)
        
        actualPipelineId = abVariant === 'a'
          ? abExperiment.variant_a_pipeline_id
          : abExperiment.variant_b_pipeline_id
      }
    } catch (error) {
      console.warn('[PipelineRunner] Erro ao buscar experimentos A/B:', error)
      // Continuar com pipeline original
    }
  }
  
  // Buscar pipeline (pode ser diferente se em experimento A/B)
  const pipeline = await getPipelineById(actualPipelineId)
  
  // Verificar se pipeline está ativo ou se é draft e está permitido
  if (!pipeline.active && !(allowDraft && pipeline.draft)) {
    throw new Error('Pipeline is inactive')
  }

  const collaborationRuntime = buildTeamRuntime(options?.collaboration?.team)

  // Ordenar steps por ordem
  const steps: PipelineStep[] = pipeline.steps.sort((a: any, b: any) => a.order - b.order)

  if (steps.length === 0) {
    throw new Error('Pipeline has no steps')
  }

      // Estrutura para rastrear branches condicionais
      interface BranchContext {
        context: any[]
        stepIndex: number
        executedSteps: PipelineExecutionResult[] // Steps executados neste branch
        variableContext: VariableContext // Contexto de variáveis acumulado
      }
      
      // Construir contexto inicial de variáveis
      const initialVariableContext = buildVariableContext([], inputMessages)
      
      // Começar com um único branch
      let activeBranches: BranchContext[] = [{
        context: inputMessages,
        stepIndex: 0,
        executedSteps: [],
        variableContext: initialVariableContext,
      }]
  
  const allResults: PipelineExecutionResult[] = []

  // Processar steps com suporte a branches condicionais
  while (activeBranches.length > 0) {
    const nextBranches: BranchContext[] = []
    
    // Processar cada branch ativo
    for (const branch of activeBranches) {
      // Se chegamos ao fim dos steps, finalizar este branch
      if (branch.stepIndex >= steps.length) {
        allResults.push(...branch.executedSteps)
        continue
      }
      
      // Agrupar steps por ordem (steps com mesma ordem podem ser branches)
      const currentOrder = steps[branch.stepIndex].order
      const stepsAtCurrentOrder = steps.filter(s => s.order === currentOrder)
      
      // Filtrar steps que atendem suas condições antes de executar em paralelo
      const stepsToExecute: PipelineStep[] = []
      
      for (const step of stepsAtCurrentOrder) {
        // Verificar condição se existir
        if (step.condition) {
          const contextText = branch.context
            .map(msg => String(msg.content || ''))
            .join(' ')
          
          const conditionMet = evaluateCondition(step.condition, contextText)
          
          if (!conditionMet) {
            console.log(`[PipelineRunner] Step ${step.order} (${step.agent_id}) não executado - condição não atendida`)
            continue // Pular este step se condição não for atendida
          }
        }
        
        stepsToExecute.push(step)
      }
      
      // Executar steps em paralelo usando Promise.all
      const executedAtThisOrder: PipelineExecutionResult[] = []
      const outputsAtThisOrder: string[] = []
      
      if (stepsToExecute.length > 0) {
        // Construir contexto de variáveis atualizado para este branch
        const currentVariableContext = buildVariableContext(
          branch.executedSteps.map(es => ({
            agent_id: es.agent_id,
            order: steps.findIndex(s => s.agent_id === es.agent_id) + 1,
            output: es.output,
          })),
          branch.context
        )
        
        // Executar todos os steps desta ordem em paralelo
        const parallelExecutions = stepsToExecute.map(async (step) => {
          // Criar contexto de variáveis para este step específico
          const stepVariableContext = { ...currentVariableContext }
          if (step.variables) {
            Object.assign(stepVariableContext, step.variables)
          }

          const executeFallback = async () => {
            if (!step.fallback_agent_id) return null
            try {
              const fallbackExecution = await runAgentWithStepContext({
                agentId: step.fallback_agent_id,
                step,
                branchContext: branch.context,
                stepVariableContext,
                onProgress,
                totalSteps: steps.length,
              })
              return fallbackExecution
            } catch (fallbackError: any) {
              console.error(
                `[PipelineRunner] Fallback também falhou para step ${step.order}:`,
                fallbackError.message
              )
              return null
            }
          }

          try {
            if (collaborationRuntime) {
              const collaborativeResult = await executeCollaborativeTeamStep({
                teamRuntime: collaborationRuntime,
                step,
                branchContext: branch.context,
                stepVariableContext,
                onProgress,
                totalSteps: steps.length,
              })

              if (collaborativeResult.success && collaborativeResult.stepResult) {
                let finalStepResult = collaborativeResult.stepResult
                const supervisorConfig = step.supervisor

                if (supervisorConfig?.supervisorAgentId) {
                  const collaborationSummary = JSON.stringify(collaborativeResult.metadata ?? {}, null, 2).slice(0, 1200)
                  const review = await runSupervisorReview({
                    supervisorConfig,
                    step,
                    stepResult: finalStepResult,
                    collaborationSummary,
                    branchContext: branch.context,
                    stepVariableContext,
                    onProgress,
                    totalSteps: steps.length,
                  })

                  finalStepResult = {
                    ...finalStepResult,
                    metadata: {
                      ...(finalStepResult.metadata ?? {}),
                      supervisor: review.metadata,
                    },
                  }

                  if (review.decision === 'changes_requested') {
                    throw new Error(`Supervisor rejeitou a saída da equipe: ${review.summary || review.rawOutput}`)
                  }

                  if (review.decision === 'escalate_human') {
                    throw new Error(`SUPERVISOR_ESCALATION::${review.summary || review.rawOutput}`)
                  }
                }

                return {
                  success: true,
                  stepResult: finalStepResult,
                  agentName: collaborativeResult.agentName || 'Equipe colaborativa',
                  agentIcon: collaborativeResult.agentIcon || '',
                  step,
                }
              }

              // Se execução colaborativa falhar, tentar fallback padrão
              const fallbackExecution = await executeFallback()
              if (fallbackExecution) {
                let fallbackResult = fallbackExecution.stepResult

                if (step.supervisor?.supervisorAgentId) {
                  const review = await runSupervisorReview({
                    supervisorConfig: step.supervisor,
                    step,
                    stepResult: fallbackResult,
                    branchContext: branch.context,
                    stepVariableContext,
                    onProgress,
                    totalSteps: steps.length,
                  })

                  fallbackResult = {
                    ...fallbackResult,
                    metadata: {
                      ...(fallbackResult.metadata ?? {}),
                      supervisor: review.metadata,
                    },
                  }

                  if (review.decision === 'changes_requested') {
                    throw new Error(`Supervisor rejeitou a saída do fallback: ${review.summary || review.rawOutput}`)
                  }

                  if (review.decision === 'escalate_human') {
                    throw new Error(`SUPERVISOR_ESCALATION::${review.summary || review.rawOutput}`)
                  }
                }

                return {
                  success: true,
                  stepResult: fallbackResult,
                  agentName: fallbackExecution.agentName,
                  agentIcon: fallbackExecution.agentIcon,
                  step,
                }
              }

              throw collaborativeResult.error || new Error('Falha na execução colaborativa')
            }

            const execution = await runAgentWithStepContext({
              agentId: step.agent_id,
              step,
              branchContext: branch.context,
              stepVariableContext,
              onProgress,
              totalSteps: steps.length,
            })

            let baseResult = execution.stepResult

            if (step.supervisor?.supervisorAgentId) {
              const review = await runSupervisorReview({
                supervisorConfig: step.supervisor,
                step,
                stepResult: baseResult,
                branchContext: branch.context,
                stepVariableContext,
                onProgress,
                totalSteps: steps.length,
              })

              baseResult = {
                ...baseResult,
                metadata: {
                  ...(baseResult.metadata ?? {}),
                  supervisor: review.metadata,
                },
              }

              if (review.decision === 'changes_requested') {
                throw new Error(`Supervisor rejeitou a saída: ${review.summary || review.rawOutput}`)
              }

              if (review.decision === 'escalate_human') {
                throw new Error(`SUPERVISOR_ESCALATION::${review.summary || review.rawOutput}`)
              }
            }

            return {
              success: true,
              stepResult: baseResult,
              agentName: execution.agentName,
              agentIcon: execution.agentIcon,
              step,
            }
          } catch (error: any) {
            console.error(`[PipelineRunner] Erro no step ${step.order}:`, {
              agent_id: step.agent_id,
              error: error.message,
              stack: error.stack,
            })

            const fallbackExecution = await executeFallback()
            if (fallbackExecution) {
              let fallbackResult = fallbackExecution.stepResult

              if (step.supervisor?.supervisorAgentId) {
                const review = await runSupervisorReview({
                  supervisorConfig: step.supervisor,
                  step,
                  stepResult: fallbackResult,
                  branchContext: branch.context,
                  stepVariableContext,
                  onProgress,
                  totalSteps: steps.length,
                })

                fallbackResult = {
                  ...fallbackResult,
                  metadata: {
                    ...(fallbackResult.metadata ?? {}),
                    supervisor: review.metadata,
                  },
                }

                if (review.decision === 'changes_requested') {
                  throw new Error(`Supervisor rejeitou a saída do fallback: ${review.summary || review.rawOutput}`)
                }

                if (review.decision === 'escalate_human') {
                  throw new Error(`SUPERVISOR_ESCALATION::${review.summary || review.rawOutput}`)
                }
              }

              return {
                success: true,
                stepResult: fallbackResult,
                agentName: fallbackExecution.agentName,
                agentIcon: fallbackExecution.agentIcon,
                step,
              }
            }

            let errorAgentName = 'Agente Desconhecido'
            let errorAgentIcon = ''
            try {
              const agentInfo = await getAgentCached(step.agent_id)
              errorAgentName = agentInfo.name || errorAgentName
              errorAgentIcon = agentInfo.icon || errorAgentIcon
            } catch (fetchError) {
              // ignorar
            }
            if (onProgress) {
              onProgress({
                step: step.order,
                totalSteps: steps.length,
                agentId: step.agent_id,
                agentName: errorAgentName,
                agentIcon: errorAgentIcon,
                status: 'error',
              })
            }

            return {
              success: false,
              error: new Error(
                `Erro ao executar step ${step.order} (agente ${step.agent_id}): ${error.message}`
              ),
              step,
            }
          }
        })
        
        // Aguardar todas as execuções paralelas
        const results = await Promise.all(parallelExecutions)
        
        // Processar resultados
        for (const result of results) {
          if (result.success) {
            executedAtThisOrder.push(result.stepResult)
            outputsAtThisOrder.push(result.stepResult.output)
          } else {
            // Se qualquer step falhar, lançar erro
            throw result.error
          }
        }
        
        if (stepsToExecute.length > 1) {
          console.log(`[PipelineRunner] Executados ${stepsToExecute.length} steps em paralelo na ordem ${currentOrder}`)
        }
      }
      
      // Se nenhum step foi executado nesta ordem, avançar para próxima ordem
      if (executedAtThisOrder.length === 0) {
        // Avançar para próxima ordem única
        const nextOrder = Math.min(...steps.filter(s => s.order > currentOrder).map(s => s.order))
        if (isFinite(nextOrder)) {
          nextBranches.push({
            context: branch.context,
            stepIndex: steps.findIndex(s => s.order === nextOrder),
            executedSteps: branch.executedSteps,
            variableContext: branch.variableContext, // Manter contexto de variáveis
          })
        } else {
          // Fim do pipeline, adicionar resultados
          allResults.push(...branch.executedSteps)
        }
        continue
      }
      
      // Mergear outputs se houver múltiplos (mesma ordem = branches condicionais)
      let mergedOutput: string
      if (outputsAtThisOrder.length === 1) {
        mergedOutput = outputsAtThisOrder[0]
      } else {
        // Determinar estratégia de merge (pegar do primeiro step ou usar concat por padrão)
        const mergeStrategy = stepsAtCurrentOrder[0]?.merge_strategy || 'concat'
        mergedOutput = mergeOutputs(outputsAtThisOrder, mergeStrategy)
        console.log(`[PipelineRunner] Múltiplos outputs mergeados usando estratégia: ${mergeStrategy}`)
      }
      
      // Adicionar resultados ao branch
      const updatedExecutedSteps = [...branch.executedSteps, ...executedAtThisOrder]
      
      // Atualizar contexto de variáveis com novos outputs
      const updatedVariableContext = buildVariableContext(
        updatedExecutedSteps.map(es => ({
          agent_id: es.agent_id,
          order: steps.findIndex(s => s.agent_id === es.agent_id) + 1,
          output: es.output,
        })),
        branch.context
      )
      
      // Criar novo contexto para próximo step
      const nextContext = [{ role: 'user', content: mergedOutput }]
      
      // Avançar para próxima ordem
      const nextOrder = Math.min(...steps.filter(s => s.order > currentOrder).map(s => s.order))
      if (isFinite(nextOrder)) {
        nextBranches.push({
          context: nextContext,
          stepIndex: steps.findIndex(s => s.order === nextOrder),
          executedSteps: updatedExecutedSteps,
          variableContext: updatedVariableContext, // Contexto atualizado com novos outputs
        })
      } else {
        // Fim do pipeline
        allResults.push(...updatedExecutedSteps)
      }
    }
    
    // Atualizar branches ativos
    activeBranches = nextBranches
  }
  
  // Usar todos os resultados coletados
  const results = allResults.length > 0 ? allResults : []

  const totalLatency = Date.now() - startTime
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)

  // Salvar log da execução usando service role
  const supabaseForLogs = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: logData } = await supabaseForLogs
    .from('lab_pipeline_logs')
    .insert({
      pipeline_id: pipelineId,
      user_id: userId,
      input_messages: inputMessages,
      output_messages: results.map(r => ({
        agent_id: r.agent_id,
        output: r.output,
        latency_ms: r.latency,
        cost_usd: r.cost,
      })),
      steps_executed: results.length,
      total_latency_ms: totalLatency,
      total_cost_usd: totalCost,
    })
    .select()
    .single()

  // Atualizar métricas históricas para cada step (para futuras estimativas)
  // Buscar pipeline para obter ordem dos steps
  const { data: pipelineStepsRecord } = await supabaseForLogs
    .from('lab_agent_pipelines')
    .select('steps')
    .eq('id', pipelineId)
    .single()

  if (pipelineStepsRecord && pipelineStepsRecord.steps) {
    const steps = pipelineStepsRecord.steps as Array<{ order: number; agent_id: string; provider?: string; model?: string }>
    
    for (const step of steps) {
      const stepResult = results.find(r => r.agent_id === step.agent_id)
      if (stepResult) {
        // Buscar informações do agente para provider/model se não estiver no step
        let provider = step.provider
        let model = step.model
        
        if (!provider || !model) {
          try {
            const { data: agent } = await supabaseForLogs
              .from('lab_agents')
              .select('provider, model')
              .eq('id', step.agent_id)
              .single()
            if (agent) {
              provider = provider || agent.provider || undefined
              model = model || agent.model || undefined
            }
          } catch (e) {
            // Ignorar erro
          }
        }

        // Atualizar métricas usando função SQL
        await supabaseForLogs.rpc('update_pipeline_step_metrics', {
          p_pipeline_id: actualPipelineId, // Usar pipelineId real
          p_agent_id: step.agent_id,
          p_step_order: step.order,
          p_cost_usd: stepResult.cost,
          p_latency_ms: stepResult.latency,
          p_provider: provider || null,
          p_model: model || null,
        }).catch(err => {
          console.warn(`[PipelineRunner] Erro ao atualizar métricas para step ${step.order}:`, err)
        })
      }
    }

    // Vincular estimativa recente com execução real (se houver)
    if (logData && logData.id) {
      // Buscar última estimativa do usuário para este pipeline (últimos 5 minutos)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: recentEstimate } = await supabaseForLogs
        .from('lab_pipeline_cost_estimates')
        .select('id, estimated_cost_usd, estimated_latency_ms')
        .eq('pipeline_id', actualPipelineId) // Usar pipelineId real
        .eq('user_id', userId)
        .gte('created_at', fiveMinutesAgo)
        .is('actual_execution_log_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (recentEstimate) {
        const costDiff = totalCost - parseFloat(recentEstimate.estimated_cost_usd || '0')
        const costDiffPercent = recentEstimate.estimated_cost_usd > 0
          ? ((costDiff / parseFloat(recentEstimate.estimated_cost_usd)) * 100)
          : 0
        const latencyDiff = totalLatency - (recentEstimate.estimated_latency_ms || 0)
        const latencyDiffPercent = (recentEstimate.estimated_latency_ms || 0) > 0
          ? ((latencyDiff / recentEstimate.estimated_latency_ms) * 100)
          : 0

        await supabaseForLogs
          .from('lab_pipeline_cost_estimates')
          .update({
            actual_execution_log_id: logData.id,
            actual_cost_usd: totalCost,
            actual_latency_ms: totalLatency,
            cost_difference_usd: costDiff,
            cost_difference_percent: costDiffPercent,
            latency_difference_ms: latencyDiff,
            latency_difference_percent: latencyDiffPercent,
          })
          .eq('id', recentEstimate.id)
      }
    }
  }

  // Registrar execução no experimento A/B se houver
  if (abExperiment && abVariant) {
    try {
      await recordABExecution(
        abExperiment.id,
        abVariant,
        actualPipelineId,
        {
          userId,
          inputMessages,
          outputMessages: results.map(r => ({
            agent_id: r.agent_id,
            output: r.output,
            latency_ms: r.latency,
            cost_usd: r.cost,
          })),
          latencyMs: totalLatency,
          costUsd: totalCost,
          sessionId: options?.sessionId,
        }
      )
    } catch (error) {
      console.warn('[PipelineRunner] Erro ao registrar execução A/B:', error)
      // Não falhar a execução se houver erro no registro
    }
  }

  return {
    results,
    totalLatency,
    totalCost,
  }
}
