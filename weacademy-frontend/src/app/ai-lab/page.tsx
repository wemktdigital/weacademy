'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGamification } from '@/hooks/useGamification'
import { Sidebar } from '@/modules/laboratorio-ia/components/Sidebar'
import { ChatInput, Attachment } from '@/modules/laboratorio-ia/components/ChatInput'
import { MessageBubble } from '@/modules/laboratorio-ia/components/MessageBubble'
import { ChatModelSelector } from '@/modules/laboratorio-ia/components/ChatModelSelector'
import { ModelComparisonToggle } from '@/modules/laboratorio-ia/components/ModelComparisonToggle'
import { DualModelSelector } from '@/modules/laboratorio-ia/components/DualModelSelector'
import { ComparisonMessageBubble } from '@/modules/laboratorio-ia/components/ComparisonMessageBubble'
import { PipelineSelector } from '@/modules/laboratorio-ia/components/PipelineSelector'
import { PipelineProgress } from '@/modules/laboratorio-ia/components/PipelineProgress'
import { ThinkingBubble } from '@/modules/laboratorio-ia/components/ThinkingBubble'
import { TypingIndicator } from '@/modules/laboratorio-ia/components/TypingIndicator'
import { LongMessageWarning } from '@/modules/laboratorio-ia/components/LongMessageWarning'
import { CostEstimateCard } from '@/modules/laboratorio-ia/components/CostEstimateCard'
import { ModelRecommendationCard } from '@/modules/laboratorio-ia/components/ModelRecommendationCard'
import { RoutingPreferencesDialog } from '@/modules/laboratorio-ia/components/RoutingPreferencesDialog'
import { MemorySettingsDialog } from '@/modules/laboratorio-ia/components/MemorySettingsDialog'
import { ModelTipsCard } from '@/modules/laboratorio-ia/components/ModelTipsCard'
import { EmptyChatState } from '@/modules/laboratorio-ia/components/EmptyChatState'
import { useChatStore } from '@/modules/laboratorio-ia/hooks/useChatStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, Settings, History, Image, Video, Wand2, Stethoscope, Compass, ArrowRight, X, ClipboardList, Upload, Repeat, Menu, Brain } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useRouter } from 'next/navigation'
import { getAgentById } from '@/modules/laboratorio-ia/agents'
import { PointsDisplay, LevelBadge, StreakDisplay } from '@/components/gamification'
import { TourGuide } from '@/components/onboarding/TourGuide'
import { aiLabTourSteps } from '@/app/onboarding/ai-lab-tour/steps'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  is_favorite?: boolean
  attachments?: Attachment[]
  metadata?: {
    provider?: string
    model?: string
    autoSelected?: boolean  // Se o modelo foi escolhido automaticamente pelo routing
    originalProvider?: string
    originalModel?: string
    taskCategory?: string | null
    feedback?: 'positive' | 'negative'
    isComparison?: boolean
    comparisonSide?: 'A' | 'B'
    memoriesUsed?: string[] // Chaves das memórias usadas
    comparisonId?: string
    latency?: number
    cost?: number
  }
}

interface Conversation {
  id: string
  title: string
  updated_at: string
  is_favorite?: boolean
}

type ExploreItem = {
  id: string
  title: string
  description: string
  icon: string | React.ReactNode
  badge?: string
  agentId?: string
  href?: string
  provider?: string
  model?: string
  agent?: AgentSummary
}

interface AgentSummary {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  category?: string | null
  provider?: string | null
  model?: string | null
  type?: string | null
  alias?: string | null
  usage_instructions?: string | null
  expected_result?: string | null
}

interface AgentShortcut {
  id: string
  alias?: string
  lastUsed: number
  isFavorite?: boolean
}

const AGENT_SHORTCUTS_STORAGE_KEY = 'lab-agent-shortcuts'

export default function AILabPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { stats } = useGamification()
  const { toast } = useToast()
  const router = useRouter()
  const {
    provider,
    model,
    selectedAgent,
    setProvider,
    setModel,
    setSelectedAgent,
  } = useChatStore()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null)
  const [loadingElapsedSeconds, setLoadingElapsedSeconds] = useState(0)

  // Atualizar tempo decorrido durante loading
  useEffect(() => {
    if (loading && loadingStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000)
        setLoadingElapsedSeconds(elapsed)
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setLoadingElapsedSeconds(0)
    }
  }, [loading, loadingStartTime])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [modelA, setModelA] = useState({ provider: 'OpenAI', model: 'gpt-5-nano' })
  const [modelB, setModelB] = useState({ provider: 'Google', model: 'gemini-2.5-flash' })
  const [comparisonVotes, setComparisonVotes] = useState<Record<string, 'A' | 'B'>>({})
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)
  const [pipelineProgress, setPipelineProgress] = useState<{ current: number; total: number } | null>(null)
  // Map para rastrear steps por ordem e agent_id (suporta paralelização)
  const [pipelineSteps, setPipelineSteps] = useState<Map<string, {
    order: number
    agent_id: string
    agent_name: string
    agent_icon?: string
    status: 'pending' | 'running' | 'completed' | 'error'
    output_preview?: string
    metadata?: Record<string, any> | null
    team?: {
      key: string
      name: string
      strategy: string
      phase?: string
      summary?: string
      status?: 'ok' | 'review' | 'conflict'
      votes?: Array<{ option: number; score: number }>
    }
  }>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const progressCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pipelineProgressRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)
  const [modelRecommendation, setModelRecommendation] = useState<{
    recommendation: any
    alternatives: any[]
  } | null>(null)
  const [showRecommendationAlternatives, setShowRecommendationAlternatives] = useState(false)
  const [intelligentRoutingEnabled, setIntelligentRoutingEnabled] = useState(true) // Ativado por padrão
  const [routingPreferences, setRoutingPreferences] = useState({
    intelligentRoutingEnabled: true,
    maxCostUsd: null as number | null,
    preferSpeed: false,
    preferAccuracy: false,
  })
  const [feedbackSubmittingId, setFeedbackSubmittingId] = useState<string | null>(null)
  const [allAgents, setAllAgents] = useState<AgentSummary[]>([])
  const [agentShortcuts, setAgentShortcuts] = useState<AgentShortcut[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  // Estado para operações de vídeo pendentes (mapeado por messageId)
  const [pendingVideoOperations, setPendingVideoOperations] = useState<Record<string, {
    id: string
    status: 'pending' | 'processing'
    model: string
    created_at: string
  }>>({})
  const [checkingVideoStatus, setCheckingVideoStatus] = useState<string | null>(null) // messageId sendo verificado

  const quickTools = useMemo(
    () => [
      {
        id: 'remove-bg',
        title: 'Remover Fundo',
        description: 'Remova o fundo de imagens usando IA de forma rápida e precisa.',
        href: '/ai-lab/image-tools/background-remover',
        icon: <Image className="h-6 w-6 text-primary" />,
      },
      {
        id: 'video-matting',
        title: 'Matting Vídeo',
        description: 'Extraia foreground de vídeos com tecnologia avançada de matting.',
        href: '/ai-lab/image-tools/video-matting',
        icon: <Video className="h-6 w-6 text-primary" />,
      },
      {
        id: 'video-generation',
        title: 'Gerar Vídeo',
        description: 'Crie vídeos cinematográficos a partir de texto ou imagens com IA.',
        href: '/ai-lab/image-tools/video-generation',
        icon: <Wand2 className="h-6 w-6 text-primary" />,
      },
      {
        id: 'medical-analysis',
        title: 'Análise Médica',
        description: 'Analise imagens médicas, áudios e vídeos de procedimentos com IA.',
        href: '/ai-lab/medical-analysis',
        icon: <Stethoscope className="h-6 w-6 text-primary" />,
      },
    ],
    []
  )
  const [agentSearch, setAgentSearch] = useState('')
  const [isAgentExplorerOpen, setAgentExplorerOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const resolveAgentSummary = (id: string): AgentSummary | null => {
    const fromAll = allAgents.find((agent) => agent.id === id)
    if (fromAll) return fromAll
    const staticAgent = getAgentById(id)
    if (staticAgent) {
      return {
        id: staticAgent.id,
        name: staticAgent.name,
        description: staticAgent.description,
        icon: staticAgent.icon,
        category: staticAgent.category,
        provider: (staticAgent as any).provider,
        model: (staticAgent as any).model,
        type: (staticAgent as any).type,
      }
    }
    return null
  }

  const recentAgents = useMemo(() => {
    const sorted = [...agentShortcuts].sort((a, b) => b.lastUsed - a.lastUsed)
    return sorted
      .map((shortcut) => {
        const agent = resolveAgentSummary(shortcut.id)
        if (!agent) return null
        return {
          ...agent,
          alias: shortcut.alias || null,
          lastUsed: shortcut.lastUsed,
        }
      })
      .filter((agent): agent is AgentSummary & { lastUsed: number; alias: string | null } => Boolean(agent))
  }, [agentShortcuts, allAgents])

  const activeAgentDetails = useMemo(() => {
    if (!selectedAgent) return null
    const base = selectedAgent.id ? resolveAgentSummary(selectedAgent.id) : null
    const shortcut = selectedAgent.id ? agentShortcuts.find((item) => item.id === selectedAgent.id) : undefined

    return {
      id: selectedAgent.id || base?.id || '',
      name: shortcut?.alias || selectedAgent.name || base?.name || 'Agente selecionado',
      description:
        shortcut?.alias && base?.description
          ? base.description
          : selectedAgent.description || base?.description || 'Pronto para ajudar nesta conversa.',
      icon: selectedAgent.icon || base?.icon || '🤖',
      provider: (selectedAgent as any).provider || base?.provider || null,
      model: (selectedAgent as any).model || base?.model || null,
      category: selectedAgent.category || base?.category || null,
      alias: shortcut?.alias || null,
      originalName: base?.name || selectedAgent.name || null,
    }
  }, [selectedAgent, agentShortcuts, allAgents])

  const predefinedItems = useMemo<ExploreItem[]>(() =>
    allAgents.map((agent) => ({
      id: agent.id,
      title: agent.name,
      description: agent.description || 'Assistente configurado pela WE Academy.',
      icon: agent.icon || '🤖',
      badge: agent.category || undefined,
      agentId: agent.id,
      provider: agent.provider || undefined,
      model: agent.model || undefined,
      agent,
    })),
    [allAgents]
  )

  const recentItems = useMemo<ExploreItem[]>(() =>
    recentAgents.map((agent) => ({
      id: `recent-${agent.id}`,
      title: agent.name,
      description: agent.description || 'Agente personalizado ou recentemente utilizado.',
      icon: agent.icon || '🤖',
      badge: agent.category || undefined,
      agentId: agent.id,
      provider: agent.provider || undefined,
      model: agent.model || undefined,
      agent,
    })),
    [recentAgents]
  )

  const hasSearch = agentSearch.trim().length > 0

  const filteredPredefinedItems = useMemo(() => {
    if (!hasSearch) return predefinedItems
    const term = agentSearch.toLowerCase()
    return predefinedItems.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.badge?.toLowerCase().includes(term) ?? false)
    )
  }, [hasSearch, predefinedItems, agentSearch])

  const filteredRecentItems = useMemo(() => {
    if (!hasSearch) return recentItems
    const term = agentSearch.toLowerCase()
    return recentItems.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.badge?.toLowerCase().includes(term) ?? false)
    )
  }, [hasSearch, recentItems, agentSearch])

  const searchResults = useMemo(() => {
    if (!hasSearch) return []
    const merged = [...filteredRecentItems, ...filteredPredefinedItems]
    const unique = new Map<string, ExploreItem>()
    merged.forEach((item) => {
      const key = item.agentId || item.id
      if (!unique.has(key)) unique.set(key, item)
    })
    return Array.from(unique.values())
  }, [hasSearch, filteredRecentItems, filteredPredefinedItems])

  const persistAgentShortcuts = (shortcuts: AgentShortcut[]) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(AGENT_SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts))
  }

  const registerAgentUsage = (agent: AgentSummary & { alias?: string | null }) => {
    if (!agent?.id) return
    setAgentShortcuts((prev) => {
      const existing = prev.find((item) => item.id === agent.id)
      const updatedExisting = existing
        ? { ...existing, lastUsed: Date.now(), alias: existing.alias ?? agent.alias ?? undefined }
        : { id: agent.id, alias: agent.alias ?? undefined, lastUsed: Date.now() }
      const next = [updatedExisting, ...prev.filter((item) => item.id !== agent.id)].slice(0, 12)
      persistAgentShortcuts(next)
      return next
    })
  }

  const loadAgents = async () => {
    setAgentsLoading(true)
    try {
      const response = await fetch('/api/lab-ia/agents', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) {
        console.error('[AILab] Erro ao carregar agentes:', response.status, response.statusText)
        setAllAgents([])
        return
      }
      const data = await response.json()
      setAllAgents(data.agents || [])
    } catch (error) {
      console.error('[AILab] Falha ao carregar agentes:', error)
      setAllAgents([])
    } finally {
      setAgentsLoading(false)
    }
  }

  const loadAgentShortcutsFromStorage = () => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(AGENT_SHORTCUTS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const shortcuts = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return { id: item, lastUsed: Date.now() } satisfies AgentShortcut
              }
              if (item && typeof item === 'object' && typeof item.id === 'string') {
                return {
                  id: item.id,
                  alias: typeof item.alias === 'string' ? item.alias : undefined,
                  lastUsed: typeof item.lastUsed === 'number' ? item.lastUsed : Date.now(),
                } satisfies AgentShortcut
              }
              return null
            })
            .filter((item): item is AgentShortcut => Boolean(item))
          setAgentShortcuts(shortcuts)
        }
      } else {
        const legacy = localStorage.getItem('lab-recent-agents')
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy)
          if (Array.isArray(parsedLegacy)) {
            const shortcuts = parsedLegacy
              .filter((id): id is string => typeof id === 'string')
              .map((id, index) => ({ id, lastUsed: Date.now() - index }))
            setAgentShortcuts(shortcuts)
            persistAgentShortcuts(shortcuts)
            localStorage.removeItem('lab-recent-agents')
          }
        }
      }
    } catch (error) {
      console.warn('[AILab] Não foi possível carregar agentes recentes do storage:', error)
    }
  }

  useEffect(() => {
    if (user) {
      loadConversations()
      loadUserRole()
      loadRoutingPreferences()
      loadAgents()
      loadAgentShortcutsFromStorage()
    }

    // Cleanup do timeout de recomendações ao desmontar
    return () => {
      if (recommendationTimeoutRef.current) {
        clearTimeout(recommendationTimeoutRef.current)
      }
    }
  }, [user])

  // Polling de operações de vídeo pendentes
  useEffect(() => {
    if (!user) return

    // Função para verificar e processar operações pendentes
    const checkPendingVideoOperations = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        if (!token) return

        // Buscar operações pendentes do usuário
        const { data: operations, error } = await supabase
          .from('lab_video_operations')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false })
          .limit(10)

        if (error || !operations || operations.length === 0) {
          return
        }

        // Chamar endpoint de polling para processar operações
        const pollResponse = await fetch('/api/lab-ia/videos/poll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!pollResponse.ok) {
          console.error('[VIDEO-POLL] Erro ao processar operações:', pollResponse.status)
          return
        }

        const pollResult = await pollResponse.json()

        // Verificar se alguma operação foi concluída
        if (pollResult.completed > 0) {
          // Buscar operações concluídas
          const { data: completedOperations, error: fetchError } = await supabase
            .from('lab_video_operations')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(pollResult.completed)

          if (!fetchError && completedOperations && completedOperations.length > 0) {
            // Verificar se a conversa atual precisa ser atualizada
            const currentConversationOperations = completedOperations.filter(
              op => op.conversation_id === currentConversationId
            )

            for (const operation of currentConversationOperations) {
              // Remover operação do estado de pendentes
              if (operation.message_id) {
                setPendingVideoOperations(prev => {
                  const updated = { ...prev }
                  delete updated[operation.message_id]
                  return updated
                })
              }

              // Recarregar mensagens da conversa se houver vídeo pronto
              if (operation.message_id && currentConversationId) {
                await loadConversation(currentConversationId)

                // Mostrar notificação
                toast({
                  title: '🎬 Vídeo pronto!',
                  description: 'Seu vídeo foi gerado com sucesso. Veja na conversa.',

                })
              }
            }
          }

          // Atualizar estado de operações pendentes com novas operações ainda pendentes
          if (pollResult.stillPending > 0 && user && currentConversationId) {
            const { data: stillPendingOps } = await supabase
              .from('lab_video_operations')
              .select('id, message_id, status, model, created_at')
              .eq('conversation_id', currentConversationId)
              .eq('user_id', user.id)
              .in('status', ['pending', 'processing'])

            if (stillPendingOps) {
              const updatedMap: Record<string, {
                id: string
                status: 'pending' | 'processing'
                model: string
                created_at: string
              }> = {}

              stillPendingOps.forEach(op => {
                if (op.message_id) {
                  updatedMap[op.message_id] = {
                    id: op.id,
                    status: op.status as 'pending' | 'processing',
                    model: op.model,
                    created_at: op.created_at,
                  }
                }
              })

              setPendingVideoOperations(prev => ({ ...prev, ...updatedMap }))
            }
          }
        }

      } catch (error) {
        console.error('[VIDEO-POLL] Erro ao verificar operações pendentes:', error)
      }
    }

    // Verificar imediatamente e depois a cada 30 segundos
    checkPendingVideoOperations()
    const interval = setInterval(checkPendingVideoOperations, 30000) // 30 segundos

    return () => {
      clearInterval(interval)
    }
  }, [user, currentConversationId, toast])

  // Função para verificar status de vídeo manualmente
  const handleCheckVideoStatus = async (messageId: string) => {
    if (!user || checkingVideoStatus === messageId) return

    setCheckingVideoStatus(messageId)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        toast({
          title: 'Erro',
          description: 'Não autenticado. Faça login novamente.',
          variant: 'destructive',
        })
        return
      }

      // Buscar operação relacionada a esta mensagem
      const { data: operations } = await supabase
        .from('lab_video_operations')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .single()

      if (!operations) {
        toast({
          title: 'Nenhuma operação encontrada',
          description: 'Não há operação pendente para esta mensagem.',
        })
        setCheckingVideoStatus(null)
        return
      }

      // Chamar endpoint de polling
      const pollResponse = await fetch('/api/lab-ia/videos/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!pollResponse.ok) {
        throw new Error('Erro ao verificar status')
      }

      const pollResult = await pollResponse.json()

      // Se completou, recarregar conversa
      if (pollResult.completed > 0 && currentConversationId) {
        await loadConversation(currentConversationId)
        toast({
          title: '🎬 Vídeo pronto!',
          description: 'Seu vídeo foi gerado com sucesso.',
        })
      } else {
        toast({
          title: 'Status verificado',
          description: pollResult.stillPending > 0
            ? 'O vídeo ainda está sendo processado. Você será notificado quando estiver pronto.'
            : 'Nenhuma atualização no momento.',
        })
      }

      // Atualizar estado de operações pendentes
      if (currentConversationId) {
        const { data: updatedOps } = await supabase
          .from('lab_video_operations')
          .select('id, message_id, status, model, created_at')
          .eq('conversation_id', currentConversationId)
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])

        if (updatedOps) {
          const updatedMap: Record<string, {
            id: string
            status: 'pending' | 'processing'
            model: string
            created_at: string
          }> = {}

          updatedOps.forEach(op => {
            if (op.message_id) {
              updatedMap[op.message_id] = {
                id: op.id,
                status: op.status as 'pending' | 'processing',
                model: op.model,
                created_at: op.created_at,
              }
            }
          })

          setPendingVideoOperations(prev => ({ ...prev, ...updatedMap }))
        }
      }

    } catch (error: any) {
      console.error('[CHECK-VIDEO-STATUS] Erro:', error)
      toast({
        title: 'Erro ao verificar status',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setCheckingVideoStatus(null)
    }
  }

  // Carregar preferências de routing
  const loadRoutingPreferences = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) return

      const response = await fetch('/api/lab-ia/routing/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.preferences) {
          setRoutingPreferences({
            intelligentRoutingEnabled: data.preferences.intelligent_routing_enabled ?? true,
            maxCostUsd: data.preferences.max_cost_usd,
            preferSpeed: data.preferences.prefer_speed ?? false,
            preferAccuracy: data.preferences.prefer_accuracy ?? false,
          })
          setIntelligentRoutingEnabled(data.preferences.intelligent_routing_enabled ?? true)
        }
      } else if (response.status === 401) {
        // Usuário não autenticado - usar defaults silenciosamente
        // Não logar erro pois é esperado quando não há sessão
      }
    } catch (error) {
      // Silenciar erros de rede ou outros erros não críticos
      // Usar defaults se falhar
    }
  }

  const loadUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setUserRole(data?.role || null)
    } catch (error) {
      console.error('Erro ao carregar role:', error)
    }
  }

  // Removido scroll automático - usuário controla a posição manualmente
  // O scroll só acontece quando o usuário clica em "Nova Conversa" ou carrega uma conversa

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('lab_conversations')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Ordenar manualmente: favoritas primeiro, depois por data
      const sorted = (data || []).sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1
        if (!a.is_favorite && b.is_favorite) return 1
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })

      setConversations(sorted)
    } catch (error) {
      console.error('Erro ao carregar conversas:', error)
    }
  }

  const loadConversation = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('lab_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Parse attachments e metadata se existirem
      const messagesWithAttachments = (data || []).map((msg: any) => {
        // Garantir que o conteúdo seja uma string limpa
        let content = msg.content || ''
        if (typeof content === 'string') {
          // Remover escapes duplos se houver (pode acontecer ao salvar no banco)
          if (content.includes('\\n') || content.includes('\\*') || content.includes('\\#')) {
            content = content.replace(/\\n/g, '\n').replace(/\\\*/g, '*').replace(/\\#/g, '#')
          }
        }

        return {
          ...msg,
          content,
          attachments: msg.attachments ? (typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments) : undefined,
          metadata: msg.metadata ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata) : undefined,
        }
      })

      setMessages(messagesWithAttachments)
      setCurrentConversationId(conversationId)

      // Buscar operações de vídeo pendentes para esta conversa
      if (user) {
        const { data: operations, error: opsError } = await supabase
          .from('lab_video_operations')
          .select('id, message_id, status, model, created_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])

        if (!opsError && operations) {
          const operationsMap: Record<string, {
            id: string
            status: 'pending' | 'processing'
            model: string
            created_at: string
          }> = {}

          operations.forEach(op => {
            if (op.message_id) {
              operationsMap[op.message_id] = {
                id: op.id,
                status: op.status as 'pending' | 'processing',
                model: op.model,
                created_at: op.created_at,
              }
            }
          })

          setPendingVideoOperations(prev => ({ ...prev, ...operationsMap }))
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    }
  }

  const handleToggleConversationFavorite = async (id: string, currentFavorite: boolean) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/conversations/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: id,
          isFavorite: !currentFavorite,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao favoritar conversa')
      }

      // Atualizar localmente
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id
            ? { ...conv, is_favorite: !currentFavorite }
            : conv
        )
      )

      toast({
        title: !currentFavorite ? 'Conversa favoritada' : 'Favorito removido',
        description: !currentFavorite
          ? 'A conversa foi adicionada aos favoritos'
          : 'A conversa foi removida dos favoritos',
      })

      // Recarregar lista para ordenação correta
      await loadConversations()
    } catch (error: any) {
      console.error('Erro ao favoritar:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível favoritar a conversa',
        variant: 'destructive',
      })
    }
  }

  const handleToggleMessageFavorite = async (messageId: string, currentFavorite: boolean) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/messages/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messageId,
          isFavorite: !currentFavorite,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao favoritar mensagem')
      }

      // Atualizar localmente
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, is_favorite: !currentFavorite }
            : msg
        )
      )

      toast({
        title: !currentFavorite ? 'Mensagem favoritada' : 'Favorito removido',
        description: !currentFavorite
          ? 'A mensagem foi adicionada aos favoritos'
          : 'A mensagem foi removida dos favoritos',
      })
    } catch (error: any) {
      console.error('Erro ao favoritar:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível favoritar a mensagem',
        variant: 'destructive',
      })
    }
  }

  const createNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
    setSelectedAgent(null)
    setSelectedPipeline(null)
    setLoading(false)
    setIsCanceling(false)
    setComparisonMode(false)
    setComparisonVotes({})
  }

  const handleCancelPipeline = () => {
    console.log('[LAB-IA] Cancelando pipeline...')
    setIsCanceling(true)

    // Cancelar requisição SSE
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // Buscar recomendações de modelo baseado no texto
  const fetchModelRecommendations = async (text: string) => {
    if (!text.trim() || text.length < 10 || selectedAgent || selectedPipeline) {
      setModelRecommendation(null)
      return // Não buscar se texto muito curto ou se agente/pipeline selecionado
    }

    try {
      const response = await fetch('/api/lab-ia/model-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferences: routingPreferences,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.recommendation) {
          setModelRecommendation({
            recommendation: data.recommendation,
            alternatives: data.alternatives || [],
          })
        }
      }
    } catch (error) {
      console.error('Erro ao buscar recomendações:', error)
      // Silenciosamente falhar - não é crítico
    }
  }

  // Debounce para buscar recomendações
  const recommendationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handleTextChange = (text: string) => {
    // Limpar timeout anterior
    if (recommendationTimeoutRef.current) {
      clearTimeout(recommendationTimeoutRef.current)
    }

    // Buscar recomendações após 1 segundo de inatividade
    recommendationTimeoutRef.current = setTimeout(() => {
      fetchModelRecommendations(text)
    }, 1000)
  }

  const handleModelFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    const targetMessage = messages.find(message => message.id === messageId)
    if (!targetMessage || !targetMessage.metadata?.autoSelected) {
      return
    }

    if (!targetMessage.metadata?.provider || !targetMessage.metadata?.model) {
      toast({
        title: 'Não foi possível registrar o feedback',
        description: 'Modelo original não encontrado na mensagem.',
        variant: 'destructive',
      })
      return
    }

    try {
      setFeedbackSubmittingId(messageId)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch('/api/lab-ia/routing/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messageId,
          provider: targetMessage.metadata.provider,
          model: targetMessage.metadata.model,
          originalProvider: targetMessage.metadata.originalProvider,
          originalModel: targetMessage.metadata.originalModel,
          taskCategory: targetMessage.metadata.taskCategory,
          rating: rating === 'positive' ? 1 : -1,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Erro ao registrar feedback')
      }

      setMessages(prev => prev.map(message => {
        if (message.id !== messageId) return message
        return {
          ...message,
          metadata: {
            ...message.metadata,
            feedback: rating,
          },
        }
      }))

      toast({
        title: 'Feedback registrado',
        description: 'Obrigado por ajudar a melhorar as recomendações!',
      })
    } catch (error: any) {
      console.error('[Routing][Feedback] Erro ao registrar feedback:', error)
      toast({
        title: 'Erro ao registrar feedback',
        description: error?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setFeedbackSubmittingId(null)
    }
  }

  const handleComparisonMessage = async (content: string, attachments?: Attachment[]) => {
    if (!user) return

    console.log('[LAB-IA][COMPARISON] Iniciando comparação de modelos')
    console.log('[LAB-IA][COMPARISON] Modelo A:', modelA.provider, modelA.model)
    console.log('[LAB-IA][COMPARISON] Modelo B:', modelB.provider, modelB.model)

    setLoading(true)

    // Criar ou obter conversation_id
    let conversationId = currentConversationId

    if (!conversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('lab_conversations')
        .insert({
          user_id: user.id,
          title: content.substring(0, 50) || 'Nova conversa',
        })
        .select()
        .single()

      if (convError) {
        console.error('Erro ao criar conversa:', convError)
        setLoading(false)
        return
      }

      conversationId = newConversation.id
      setCurrentConversationId(conversationId)
      await loadConversations()
    }

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: attachments && attachments.length > 0 && !content.trim()
        ? '[Arquivo anexado]'
        : content,
      created_at: new Date().toISOString(),
      attachments,
    }

    setMessages((prev) => [...prev, userMessage])

    // Salvar mensagem do usuário no banco
    try {
      await supabase.from('lab_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage.content,
        ...(attachments && attachments.length > 0 && { attachments: JSON.stringify(attachments) }),
      })
    } catch (error: any) {
      if (error?.code === '42703' || error?.message?.includes('attachments')) {
        await supabase.from('lab_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: userMessage.content,
        })
      } else {
        console.error('Erro ao salvar mensagem:', error)
      }
    }

    // Criar placeholders para as respostas
    const comparisonId = `comparison-${Date.now()}`
    const responseAId = `response-a-${comparisonId}`
    const responseBId = `response-b-${comparisonId}`

    const placeholderA: Message = {
      id: responseAId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      metadata: {
        provider: modelA.provider,
        model: modelA.model,
        isComparison: true,
        comparisonSide: 'A',
        comparisonId, // ID único para agrupar o par
      },
    }

    const placeholderB: Message = {
      id: responseBId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      metadata: {
        provider: modelB.provider,
        model: modelB.model,
        isComparison: true,
        comparisonSide: 'B',
        comparisonId, // Mesmo ID para agrupar o par
      },
    }

    setMessages((prev) => [...prev, placeholderA, placeholderB])

    // Scroll para mostrar placeholders
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
    }, 100)

    // Obter token de autenticação
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    if (!token) {
      toast({
        title: 'Erro',
        description: 'Não autenticado. Por favor, faça login novamente.',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Executar ambos modelos em paralelo
    try {
      console.log('[LAB-IA][COMPARISON] Chamando modelos em paralelo...')
      const [responseA, responseB] = await Promise.allSettled([
        callLLMForComparison(modelA.provider, modelA.model, content, attachments, token),
        callLLMForComparison(modelB.provider, modelB.model, content, attachments, token),
      ])

      console.log('[LAB-IA][COMPARISON] Resposta A:', responseA.status === 'fulfilled' ? 'OK' : 'ERRO', responseA.status === 'fulfilled' ? responseA.value : responseA.reason)
      console.log('[LAB-IA][COMPARISON] Resposta B:', responseB.status === 'fulfilled' ? 'OK' : 'ERRO', responseB.status === 'fulfilled' ? responseB.value : responseB.reason)

      // Construir objetos de mensagem finais
      const contentA = responseA.status === 'fulfilled' ? (responseA.value.content || 'Erro ao obter resposta') : `Erro: ${responseA.reason?.message || 'Falha ao chamar modelo A'}`
      const finalMessageA: Message = {
        id: placeholderA.id,
        role: 'assistant',
        created_at: placeholderA.created_at,
        content: contentA,
        metadata: {
          provider: modelA.provider,
          model: modelA.model,
          isComparison: true,
          comparisonSide: 'A',
          comparisonId: comparisonId,
          latency: responseA.status === 'fulfilled' ? responseA.value.latency : undefined,
          cost: responseA.status === 'fulfilled' ? responseA.value.cost : undefined,
        },
      }

      const contentB = responseB.status === 'fulfilled' ? (responseB.value.content || 'Erro ao obter resposta') : `Erro: ${responseB.reason?.message || 'Falha ao chamar modelo B'}`
      const finalMessageB: Message = {
        id: placeholderB.id,
        role: 'assistant',
        created_at: placeholderB.created_at,
        content: contentB,
        metadata: {
          provider: modelB.provider,
          model: modelB.model,
          isComparison: true,
          comparisonSide: 'B',
          comparisonId: comparisonId,
          latency: responseB.status === 'fulfilled' ? responseB.value.latency : undefined,
          cost: responseB.status === 'fulfilled' ? responseB.value.cost : undefined,
        },
      }

      setMessages((prev) => {
        console.log('[LAB-IA][COMPARISON] Atualizando mensagens. Total antes:', prev.length)
        const updated = prev.map(msg => {
          if (msg.id === responseAId) return finalMessageA
          if (msg.id === responseBId) return finalMessageB
          return msg
        })
        console.log('[LAB-IA][COMPARISON] Total após atualização:', updated.length)
        return updated
      })

      // Salvar respostas no banco (opcional - pode falhar silenciosamente)
      if (finalMessageA) {
        try {
          const { error } = await supabase.from('lab_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalMessageA.content,
            metadata: finalMessageA.metadata ? JSON.stringify(finalMessageA.metadata) : null,
          })

          if (error) console.error('Erro ao salvar resposta A:', error)
        } catch (error) {
          console.error('Erro ao salvar resposta A:', error)
        }
      }

      if (finalMessageB) {
        try {
          const { error } = await supabase.from('lab_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalMessageB.content,
            metadata: finalMessageB.metadata ? JSON.stringify(finalMessageB.metadata) : null,
          })

          if (error) console.error('Erro ao salvar resposta B:', error)
        } catch (error) {
          console.error('Erro ao salvar resposta B:', error)
        }
      }

      // Scroll para mostrar respostas completas
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }
      }, 100)

    } catch (error: any) {
      console.error('Erro na comparação:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao comparar modelos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setLoadingStartTime(null)
      setLoadingElapsedSeconds(0)
    }
  }

  const callLLMForComparison = async (
    provider: string,
    model: string,
    content: string,
    attachments: Attachment[] | undefined,
    token: string
  ) => {
    // Incluir histórico de mensagens anteriores (exceto mensagens de comparação duplicadas)
    const processedComparisonIds = new Set<string>()
    const historyMessages = messages
      .filter(msg => {
        // Incluir mensagens do usuário
        if (msg.role === 'user') return true
        // Incluir mensagens do assistente que não são de comparação
        if (msg.role === 'assistant' && !msg.metadata?.isComparison) return true
        // Se for mensagem de comparação, incluir apenas uma (a primeira encontrada de cada par)
        if (msg.metadata?.isComparison) {
          const comparisonId = (msg.metadata as any).comparisonId || msg.id
          // Se já processamos este par, pular
          if (processedComparisonIds.has(comparisonId)) {
            return false
          }
          // Marcar como processado e incluir
          processedComparisonIds.add(comparisonId)
          return true
        }
        return false
      })
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

    const messagesForAPI = [...historyMessages, { role: 'user' as const, content }]

    // Se houver attachments, adicionar ao conteúdo
    if (attachments && attachments.length > 0) {
      // Por enquanto, apenas texto - attachments precisariam ser processados
      messagesForAPI[messagesForAPI.length - 1].content += '\n\n[Arquivos anexados: ' + attachments.map(a => a.name).join(', ') + ']'
    }

    const response = await fetch('/api/lab-ia/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: messagesForAPI,
        provider,
        model,
        stream: false, // Não usar streaming em comparação
        enableIntelligentRouting: false,
        enableCache: false,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Erro ao chamar ${provider}:${model}`)
    }

    const data = await response.json()
    console.log('[LAB-IA][COMPARISON] Resposta da API para', provider, model, ':', {
      hasContent: !!data.content,
      hasText: !!data.text,
      contentLength: (data.content || data.text || '').length,
      latency: data.latency,
      cost: data.cost,
    })
    return {
      content: data.content || data.text || '',
      latency: data.latency || 0,
      cost: data.cost || 0,
    }
  }

  const handleVote = async (
    messageId: string,
    winner: 'A' | 'B',
    modelA?: { provider: string; model: string },
    modelB?: { provider: string; model: string }
  ) => {
    setComparisonVotes(prev => ({ ...prev, [messageId]: winner }))

    // Atualizar o modelo selecionado para continuar o chat com o modelo escolhido
    if (winner === 'A' && modelA) {
      setProvider(modelA.provider)
      setModel(modelA.model)
      toast({
        title: 'Modelo selecionado',
        description: `Continuando o chat com ${modelA.provider} - ${modelA.model}`,
      })
    } else if (winner === 'B' && modelB) {
      setProvider(modelB.provider)
      setModel(modelB.model)
      toast({
        title: 'Modelo selecionado',
        description: `Continuando o chat com ${modelB.provider} - ${modelB.model}`,
      })
    }

    // Desativar modo comparação e voltar para chat único
    setComparisonMode(false)
    setLoading(false) // Garantir que o estado de loading seja limpo
    setIsCanceling(false) // Garantir que não está cancelando

    // Limpar estados de comparação
    // Manter apenas as mensagens normais (remover mensagens de comparação duplicadas)
    setMessages((prev) => {
      // Filtrar mensagens de comparação, mantendo apenas a do modelo escolhido
      const filtered: Message[] = []
      const processedComparisonIds = new Set<string>()

      for (let i = 0; i < prev.length; i++) {
        const msg = prev[i]

        // Se é mensagem de comparação
        if (msg.metadata?.isComparison) {
          const comparisonId = (msg.metadata as any).comparisonId || messageId

          // Se já processamos este par de comparação, pular
          if (processedComparisonIds.has(comparisonId)) {
            continue
          }

          // Encontrar ambas as mensagens do par
          const messageA = prev.find(m =>
            m.metadata?.isComparison &&
            m.metadata?.comparisonSide === 'A' &&
            ((m.metadata as any).comparisonId || m.id) === comparisonId
          )
          const messageB = prev.find(m =>
            m.metadata?.isComparison &&
            m.metadata?.comparisonSide === 'B' &&
            ((m.metadata as any).comparisonId || m.id) === comparisonId
          )

          if (messageA && messageB) {
            // Manter apenas a mensagem do modelo escolhido, convertendo para mensagem normal
            const chosenMessage = winner === 'A' ? messageA : messageB
            // Criar novo objeto de metadata sem isComparison e comparisonSide
            const { isComparison, comparisonSide, ...restMetadata } = chosenMessage.metadata || {}
            // Garantir que o conteúdo seja uma string limpa (sem escape duplo)
            let cleanContent = typeof chosenMessage.content === 'string'
              ? chosenMessage.content
              : String(chosenMessage.content || '')

            // Debug: verificar se o conteúdo está sendo escapado
            console.log('[LAB-IA][VOTE] Conteúdo original:', cleanContent.substring(0, 200))
            console.log('[LAB-IA][VOTE] Tipo:', typeof cleanContent)
            console.log('[LAB-IA][VOTE] Contém markdown cru?', cleanContent.includes('\\n') || cleanContent.includes('\\*'))

            // NÃO fazer unescape manual, pois isso está quebrando a formatação.
            // O conteúdo já vem correto do streaming/backend.
            // if (cleanContent.includes('\\n') || cleanContent.includes('\\*') || cleanContent.includes('\\#')) { ... }

            console.log('[LAB-IA][VOTE] Conteúdo mantido original:', cleanContent.substring(0, 50))

            filtered.push({
              ...chosenMessage,
              content: cleanContent,
              metadata: restMetadata,
            })
            processedComparisonIds.add(comparisonId)
          }
        } else {
          // Mensagem normal, manter
          filtered.push(msg)
        }
      }

      return filtered
    })

    // Opcional: salvar voto no backend para analytics
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (token) {
        // Aqui você pode criar uma API para salvar votos
        // await fetch('/api/lab-ia/comparison/vote', { ... })
      }
    } catch (error) {
      console.error('Erro ao salvar voto:', error)
    }
  }

  const handleNewMessage = async (content: string, attachments?: Attachment[]) => {
    console.log('[LAB-IA][DEBUG] handleNewMessage chamado. Content:', content.substring(0, 20), 'ComparisonMode:', comparisonMode)

    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para usar o Laboratório de IA',
        variant: 'destructive',
      })
      return
    }

    // Se modo comparação ativado e não há pipeline/agente selecionado
    if (comparisonMode && !selectedPipeline && !selectedAgent) {
      console.log('[LAB-IA] Modo: Comparação de Modelos')
      console.log('[LAB-IA] Modelo A:', modelA.provider, modelA.model)
      console.log('[LAB-IA] Modelo B:', modelB.provider, modelB.model)
      await handleComparisonMessage(content, attachments)
      return
    }

    setLoading(true)
    setIsCanceling(false)

    console.log('[LAB-IA][DEBUG] State set to loading. ConversationID:', currentConversationId)

    // Criar ou obter conversation_id
    let conversationId = currentConversationId

    if (!conversationId) {
      console.log('[LAB-IA][DEBUG] Creating new conversation...')
      const { data: newConversation, error: convError } = await supabase
        .from('lab_conversations')
        .insert({
          user_id: user.id,
          title: content.substring(0, 50) || 'Nova conversa',
        })
        .select()
        .single()

      if (convError) {
        console.error('Erro ao criar conversa:', convError)
        setLoading(false)
        return
      }

      conversationId = newConversation.id
      setCurrentConversationId(conversationId)
      console.log('[LAB-IA][DEBUG] New conversation created:', conversationId)
      await loadConversations()
    } else {
      console.log('[LAB-IA][DEBUG] Using existing conversation:', conversationId)
    }

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: attachments && attachments.length > 0 && !content.trim()
        ? '[Arquivo anexado]'
        : content,
      created_at: new Date().toISOString(),
      attachments,
    }

    setMessages((prev) => [...prev, userMessage])
    console.log('[LAB-IA][DEBUG] UI optimistically updated')

    // Scroll automático apenas no container do chat
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
    }, 100)

    // Salvar mensagem do usuário no banco
    try {
      console.log('[LAB-IA][DEBUG] Saving user message to DB...')
      await supabase.from('lab_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage.content,
        ...(attachments && attachments.length > 0 && { attachments: JSON.stringify(attachments) }),
      })
      console.log('[LAB-IA][DEBUG] User message saved to DB')
    } catch (error: any) {
      // Se o campo attachments não existir, tentar sem ele
      console.warn('[LAB-IA][DEBUG] Error saving message, retrying without attachments if needed:', error)
      if (error?.code === '42703' || error?.message?.includes('attachments')) {
        await supabase.from('lab_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: userMessage.content,
        })
      } else {
        console.error('Erro ao salvar mensagem:', error)
      }
    }

    // Chamar API para resposta do assistente (pipeline ou agente único)
    try {
      console.log('[LAB-IA][DEBUG] Getting session token...')
      // Obter token de autenticação
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      console.log('[LAB-IA] Token disponível:', !!token)
      console.log('[LAB-IA] User ID:', user?.id)
      console.log('[LAB-IA] Session Error:', sessionError)
      console.log('[LAB-IA] Modo:', selectedPipeline ? 'Pipeline' : selectedAgent ? 'Agente único' : 'Chat padrão')

      if (!token) {
        throw new Error('Não autenticado. Por favor, faça login novamente.')
      }

      // Se pipeline selecionado, usar API de pipeline
      const apiUrl = selectedPipeline
        ? '/api/lab-ia/pipelines/run'
        : '/api/lab-ia/chat'

      // Limpar estado anterior de progresso (cancelar timeout anterior se houver)
      if (progressCleanupTimeoutRef.current) {
        clearTimeout(progressCleanupTimeoutRef.current)
        progressCleanupTimeoutRef.current = null
      }

      // Cancelar requisição anterior se houver
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Limpar imediatamente estado anterior antes de iniciar nova execução
      // IMPORTANTE: Limpar primeiro para garantir estado limpo
      console.log('[LAB-IA] Limpando estado anterior de progresso')
      setPipelineProgress(null)
      setPipelineSteps(new Map())
      setIsCanceling(false)

      // Inicializar progresso do pipeline se aplicável
      // O Map de steps será preenchido à medida que eventos SSE chegam
      if (selectedPipeline && selectedPipeline.steps) {
        const totalSteps = selectedPipeline.steps.length

        // Inicializar progresso (steps serão preenchidos via eventos SSE)
        console.log('[LAB-IA] Inicializando progresso:', { current: 0, total: totalSteps })
        setPipelineProgress({ current: 0, total: totalSteps })

        // Scroll para mostrar o progresso do pipeline
        setTimeout(() => {
          if (pipelineProgressRef.current) {
            pipelineProgressRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          } else if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
              top: 0,
              behavior: 'smooth',
            })
          }
        }, 100)
      }

      // Criar mensagem placeholder para o assistente ANTES de chamar a API (para obter messageId)
      // Isso é necessário para operações assíncronas como VEO 3.1
      let assistantMessageId: string | undefined = undefined
      const isVeoModel = !selectedPipeline && !selectedAgent && provider === 'Google' && (model.includes('veo') || model.includes('Veo'))

      if (isVeoModel) {
        // Para modelos VEO, criar mensagem placeholder no banco ANTES de chamar a API
        const placeholderContent = '🎬 **Vídeo em processamento**\n\nSeu vídeo está sendo gerado...'
        const { data: assistantMessageData, error: assistantMessageError } = await supabase
          .from('lab_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: placeholderContent,
          })
          .select()
          .single()

        if (!assistantMessageError && assistantMessageData) {
          assistantMessageId = assistantMessageData.id
          // Adicionar mensagem placeholder ao estado local
          const placeholderMessage: Message = {
            id: assistantMessageData.id,
            role: 'assistant',
            content: placeholderContent,
            created_at: assistantMessageData.created_at,
            metadata: {
              provider,
              model,
            },
          }
          setMessages((prev) => [...prev, placeholderMessage])

          // Buscar operação pendente relacionada a esta mensagem após um breve delay
          // (para dar tempo da API salvar a operação no banco)
          setTimeout(async () => {
            if (assistantMessageId && user) {
              const { data: operation } = await supabase
                .from('lab_video_operations')
                .select('id, message_id, status, model, created_at')
                .eq('message_id', assistantMessageId)
                .eq('user_id', user.id)
                .in('status', ['pending', 'processing'])
                .single()

              if (operation && operation.message_id) {
                setPendingVideoOperations(prev => ({
                  ...prev,
                  [operation.message_id]: {
                    id: operation.id,
                    status: operation.status as 'pending' | 'processing',
                    model: operation.model,
                    created_at: operation.created_at,
                  },
                }))
              }
            }
          }, 1000) // Delay de 1 segundo para garantir que a operação foi salva
        }
      }

      const requestBody = selectedPipeline
        ? {
          pipelineId: selectedPipeline.id,
          messages: [...messages, userMessage],
        }
        : {
          conversationId,
          messageId: assistantMessageId, // Passar messageId para operações assíncronas
          messages: [...messages, userMessage],
          provider,
          model,
          agentId: selectedAgent?.id,
          // Só usar routing inteligente se NÃO houver agente selecionado E se a opção de routing estiver ativada
          // Além disso, se o usuário selecionou um modelo específico (não é Auto), respeitar a escolha
          enableIntelligentRouting: intelligentRoutingEnabled && !selectedAgent && (provider === 'Auto' || model === 'auto'),
          enableFallback: intelligentRoutingEnabled,
          enableCache: true,
          preferences: routingPreferences, // Passar preferências para o routing
        }

      let assistantContent = ''
      const tempAssistantId = assistantMessageId || `temp-assistant-${Date.now()}`
      let firstProgressEvent = true // Flag para scrollar apenas no primeiro evento de progresso

      // Pipelines agora retornam SSE (Server-Sent Events)
      if (selectedPipeline) {
        // Criar AbortController para cancelamento
        abortControllerRef.current = new AbortController()

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
          console.error('[LAB-IA] Erro na API:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url: apiUrl,
            pipelineId: selectedPipeline?.id,
          })

          const errorMessage = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : errorData.error || `Erro ao obter resposta (${response.status})`

          throw new Error(errorMessage)
        }

        // Processar SSE stream
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('Stream não disponível')
        }

        let buffer = ''

        try {
          while (true) {
            // Verificar se foi cancelado antes de ler
            if (abortControllerRef.current?.signal.aborted) {
              console.log('[LAB-IA] Pipeline cancelado, parando leitura do stream')
              break
            }

            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Manter última linha incompleta no buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (data.type === 'progress') {
                    const progressData = data.data
                    console.log('[LAB-IA] Evento de progresso recebido:', {
                      step: progressData.step,
                      total: progressData.totalSteps,
                      agentName: progressData.agentName,
                      status: progressData.status,
                    })

                    // Scroll para mostrar progresso no primeiro evento
                    if (firstProgressEvent) {
                      firstProgressEvent = false
                      setTimeout(() => {
                        if (pipelineProgressRef.current) {
                          pipelineProgressRef.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        } else if (chatContainerRef.current) {
                          chatContainerRef.current.scrollTo({
                            top: 0,
                            behavior: 'smooth',
                          })
                        }
                      }, 50)
                    }

                    // Atualizar progresso
                    setPipelineProgress({
                      current: progressData.step,
                      total: progressData.totalSteps,
                    })

                    // Atualizar steps (suporta múltiplos steps na mesma ordem - paralelização)
                    setPipelineSteps((prev) => {
                      const updated = new Map(prev)
                      // Chave única: ordem + agent_id (permite múltiplos agentes na mesma ordem)
                      const stepKey = `${progressData.step}-${progressData.agentId}`
                      const previous = updated.get(stepKey)

                      updated.set(stepKey, {
                        order: progressData.step,
                        agent_id: progressData.agentId,
                        agent_name: progressData.agentName || previous?.agent_name || 'Agente colaborativo',
                        agent_icon: progressData.agentIcon ?? previous?.agent_icon,
                        status: progressData.status,
                        output_preview:
                          progressData.status === 'completed'
                            ? progressData.output ?? previous?.output_preview
                            : previous?.output_preview,
                        metadata: progressData.metadata ?? previous?.metadata ?? null,
                        team: progressData.team
                          ? {
                            key: progressData.team.key,
                            name: progressData.team.name,
                            strategy: progressData.team.strategy,
                            phase: progressData.team.phase ?? previous?.team?.phase,
                            summary: progressData.team.summary ?? previous?.team?.summary,
                            status: progressData.team.status ?? previous?.team?.status,
                            votes: progressData.team.votes ?? previous?.team?.votes,
                          }
                          : previous?.team,
                      })

                      return updated
                    })
                  } else if (data.type === 'done') {
                    // Pipeline concluído
                    assistantContent = data.data.content || ''
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: tempAssistantId,
                        role: 'assistant' as const,
                        content: assistantContent,
                        created_at: new Date().toISOString(),
                      },
                    ])
                  } else if (data.type === 'error') {
                    // Erro no pipeline
                    throw new Error(data.data.error || 'Erro ao executar pipeline')
                  }
                } catch (err) {
                  console.error('[LAB-IA] Erro ao processar evento SSE:', err)
                }
              }
            }
          }
        } catch (error: any) {
          // Verificar se foi cancelado
          if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
            console.log('[LAB-IA] Pipeline cancelado pelo usuário')
            setIsCanceling(false)
            setMessages((prev) => [
              ...prev,
              {
                id: tempAssistantId,
                role: 'assistant' as const,
                content: '❌ Execução do pipeline cancelada pelo usuário.',
                created_at: new Date().toISOString(),
              },
            ])
            // Limpar progresso após um delay
            setTimeout(() => {
              setPipelineProgress(null)
              setPipelineSteps(new Map())
            }, 2000)
            return // Sair sem erro
          }
          throw error // Re-lançar se não for cancelamento
        }
      } else {
        // Chat normal (não-pipeline)
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
          console.error('[LAB-IA] Erro na API:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url: apiUrl,
            pipelineId: selectedPipeline?.id,
          })

          const errorMessage = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : errorData.error || `Erro ao obter resposta (${response.status})`

          throw new Error(errorMessage)
        }
        // Chat normal pode ser stream ou JSON
        const contentType = response.headers.get('content-type')
        const isStream = contentType?.includes('text/event-stream') || contentType?.includes('text/plain')

        if (isStream) {
          // Resposta em streaming
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

          let isFirstChunk = true
          let messageMetadata: Message['metadata'] | undefined = undefined
          let buffer = ''
          let metadataProcessed = false
          let isAccumulatingBase64 = false // Flag para indicar que estamos acumulando URL base64
          let isAccumulatingHttpUrl = false // Flag para indicar que estamos acumulando URL HTTP (Replicate)

          while (true) {
            const { done, value } = await reader!.read()
            if (done) {
              // Processar buffer final se houver
              if (buffer.trim() || isAccumulatingBase64 || isAccumulatingHttpUrl) {
                // Se estávamos acumulando base64, adicionar buffer final
                if (isAccumulatingBase64) {
                  const cleanBuffer = buffer.replace(/\s+/g, '')
                  assistantContent += cleanBuffer
                  isAccumulatingBase64 = false
                  console.log('[LAB-IA][STREAM] Finalizando acumulação base64, tamanho final:', assistantContent.length)
                } else if (isAccumulatingHttpUrl) {
                  // Se estávamos acumulando HTTP, adicionar buffer final (sem remover espaços, mas remover quebras de linha dentro da URL)
                  const cleanBuffer = buffer.replace(/\n/g, '').replace(/\r/g, '')
                  assistantContent += cleanBuffer
                  isAccumulatingHttpUrl = false
                  console.log('[LAB-IA][STREAM] Finalizando acumulação HTTP, tamanho final:', assistantContent.length)
                } else if (buffer.trim()) {
                  // Processar qualquer conteúdo restante
                  if (buffer.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(buffer.slice(6))
                      if (data.type === 'metadata' && data.data && !metadataProcessed) {
                        messageMetadata = {
                          provider: data.data.provider,
                          model: data.data.model,
                          autoSelected: data.data.autoSelected,
                          originalProvider: data.data.originalProvider,
                          originalModel: data.data.originalModel,
                          taskCategory: data.data.taskCategory ?? null,
                          memoriesUsed: data.data.memoriesUsed || undefined,
                        }
                        metadataProcessed = true
                      } else if (data.type === 'memory_created' && data.data) {
                        // Notificação de nova memória criada
                        toast({
                          title: '🧠 Nova memória salva',
                          description: data.data.message || `${data.data.count} nova${data.data.count > 1 ? 's' : ''} memória${data.data.count > 1 ? 's' : ''} criada${data.data.count > 1 ? 's' : ''}`,

                        })
                      }
                    } catch (e) {
                      // Não é JSON, usar como conteúdo
                      const content = buffer.slice(6) // Remover 'data: '
                      // Verificar se estamos no meio de uma URL base64 (dentro de markdown image ou video)
                      const isInBase64Url = (
                        (assistantContent.includes('![Imagem gerada](data:') ||
                          assistantContent.includes('![Imagemgerada](data:') ||
                          assistantContent.includes('![Vídeo gerado](data:') ||
                          assistantContent.includes('![Vídeogerado](data:')) &&
                        !assistantContent.includes(')') &&
                        (assistantContent.includes('base64,') || content.match(/^[A-Za-z0-9+/=]/))
                      )
                      // Verificar se estamos no meio de uma URL HTTP (dentro de markdown image ou video)
                      const isInHttpUrl = (
                        (assistantContent.includes('![Imagem gerada](https://') ||
                          assistantContent.includes('![Imagemgerada](https://') ||
                          assistantContent.includes('![Imagem gerada](http://') ||
                          assistantContent.includes('![Imagemgerada](http://') ||
                          (assistantContent.includes('![Imagem') && (assistantContent.includes('https://') || assistantContent.includes('http://'))) ||
                          assistantContent.includes('![Vídeo gerado](https://') ||
                          assistantContent.includes('![Vídeogerado](https://') ||
                          assistantContent.includes('![Vídeo gerado](http://') ||
                          assistantContent.includes('![Vídeogerado](http://') ||
                          (assistantContent.includes('![Vídeo') && (assistantContent.includes('https://') || assistantContent.includes('http://')))) &&
                        !assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) &&
                        !assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/) &&
                        !assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) &&
                        !assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/) &&
                        !assistantContent.match(/!\[Vídeo\s?gerado\]\(data:video\/[^)]+\)/) &&
                        !assistantContent.match(/!\[Vídeogerado\]\(data:video\/[^)]+\)/)
                      )

                      if (isInBase64Url) {
                        assistantContent += content.replace(/\s+/g, '')
                      } else if (isInHttpUrl) {
                        assistantContent += content.replace(/\n/g, '').replace(/\r/g, '')
                      } else {
                        assistantContent += content
                      }
                      console.log('[LAB-IA][STREAM] Conteúdo final recebido:', content.substring(0, 200))
                    }
                  } else {
                    // Verificar se estamos no meio de uma URL base64 (dentro de markdown image ou video)
                    const isInBase64Url = (
                      (assistantContent.includes('![Imagem gerada](data:') ||
                        assistantContent.includes('![Imagemgerada](data:') ||
                        assistantContent.includes('![Vídeo gerado](data:') ||
                        assistantContent.includes('![Vídeogerado](data:')) &&
                      !assistantContent.includes(')') &&
                      (assistantContent.includes('base64,') || buffer.trim().match(/^[A-Za-z0-9+/=]/))
                    )
                    // Verificar se estamos no meio de uma URL HTTP (dentro de markdown image ou video)
                    const isInHttpUrl = (
                      (assistantContent.includes('![Imagem gerada](https://') ||
                        assistantContent.includes('![Imagemgerada](https://') ||
                        assistantContent.includes('![Imagem gerada](http://') ||
                        assistantContent.includes('![Imagemgerada](http://') ||
                        (assistantContent.includes('![Imagem') && (assistantContent.includes('https://') || assistantContent.includes('http://'))) ||
                        assistantContent.includes('![Vídeo gerado](https://') ||
                        assistantContent.includes('![Vídeogerado](https://') ||
                        assistantContent.includes('![Vídeo gerado](http://') ||
                        assistantContent.includes('![Vídeogerado](http://') ||
                        (assistantContent.includes('![Vídeo') && (assistantContent.includes('https://') || assistantContent.includes('http://')))) &&
                      !assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) &&
                      !assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/) &&
                      !assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) &&
                      !assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/) &&
                      !assistantContent.match(/!\[Vídeo\s?gerado\]\(data:video\/[^)]+\)/) &&
                      !assistantContent.match(/!\[Vídeogerado\]\(data:video\/[^)]+\)/)
                    )

                    if (isInBase64Url) {
                      assistantContent += buffer.trim().replace(/\s+/g, '')
                    } else if (isInHttpUrl) {
                      assistantContent += buffer.replace(/\n/g, '').replace(/\r/g, '')
                    } else {
                      assistantContent += buffer
                    }
                    console.log('[LAB-IA][STREAM] Conteúdo final direto:', buffer.substring(0, 200))
                  }
                }
              }

              // Garantir que a UI seja atualizada com o conteúdo final
              setMessages((prev) => {
                const existingIndex = prev.findIndex((m) => m.id === tempAssistantId)
                if (existingIndex !== -1) {
                  const updated = [...prev]
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    content: assistantContent,
                    metadata: messageMetadata,
                  }
                  return updated
                }
                return [
                  ...prev,
                  {
                    id: tempAssistantId,
                    role: 'assistant' as const,
                    content: assistantContent,
                    created_at: new Date().toISOString(),
                    metadata: messageMetadata,
                  },
                ]
              })

              break
            }

            buffer += decoder.decode(value, { stream: true })

            // Processar metadados apenas no início (primeiro evento SSE)
            if (!metadataProcessed && buffer.includes('\n\n')) {
              const parts = buffer.split('\n\n', 2)
              const firstPart = parts[0]

              if (firstPart.startsWith('data: ')) {
                try {
                  const data = JSON.parse(firstPart.slice(6))
                  if (data.type === 'metadata' && data.data) {
                    messageMetadata = {
                      provider: data.data.provider,
                      model: data.data.model,
                      autoSelected: data.data.autoSelected,
                      originalProvider: data.data.originalProvider,
                      originalModel: data.data.originalModel,
                      taskCategory: data.data.taskCategory ?? null,
                      memoriesUsed: data.data.memoriesUsed || undefined,
                    }
                    metadataProcessed = true
                    buffer = parts[1] || '' // Continuar com o resto do buffer
                    continue
                  } else if (data.type === 'memory_created' && data.data) {
                    // Notificação de nova memória criada
                    toast({
                      title: '🧠 Nova memória salva',
                      description: data.data.message || `${data.data.count} nova${data.data.count > 1 ? 's' : ''} memória${data.data.count > 1 ? 's' : ''} criada${data.data.count > 1 ? 's' : ''}`,

                    })
                    buffer = parts[1] || '' // Continuar com o resto do buffer
                    continue
                  }
                } catch (e) {
                  // Não é metadados, continuar normalmente
                }
              }
              metadataProcessed = true // Marcar como processado mesmo se não encontrou metadados
            }

            // Se estamos acumulando base64, não processar linha por linha - acumular tudo até encontrar o fechamento
            if (isAccumulatingBase64) {
              // Verificar se o buffer contém o fechamento da URL base64
              const imageEndMatch = buffer.match(/!\[Imagem gerada\]\(data:[^)]+\)/)
              if (imageEndMatch) {
                // Encontramos o fechamento, processar normalmente
                isAccumulatingBase64 = false
              } else {
                // Ainda acumulando, adicionar tudo ao conteúdo sem quebras
                const cleanBuffer = buffer.replace(/\s+/g, '')
                assistantContent += cleanBuffer
                buffer = '' // Limpar buffer já que adicionamos tudo
                console.log('[LAB-IA][STREAM] Acumulando base64, tamanho atual:', assistantContent.length)
                continue // Pular processamento de linhas
              }
            }

            // Se estamos acumulando HTTP, não processar linha por linha - acumular tudo até encontrar o fechamento
            if (isAccumulatingHttpUrl) {
              // Verificar se o buffer contém o fechamento da URL HTTP (imagem ou vídeo)
              const imageEndMatchHttp = buffer.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) ||
                buffer.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/)
              const videoEndMatchHttp = buffer.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) ||
                buffer.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/)
              if (imageEndMatchHttp || videoEndMatchHttp) {
                // Encontramos o fechamento, processar normalmente
                isAccumulatingHttpUrl = false
              } else {
                // Ainda acumulando, adicionar tudo ao conteúdo (remover apenas quebras de linha dentro da URL)
                const cleanBuffer = buffer.replace(/\n/g, '').replace(/\r/g, '')
                assistantContent += cleanBuffer
                buffer = '' // Limpar buffer já que adicionamos tudo
                console.log('[LAB-IA][STREAM] Acumulando HTTP, tamanho atual:', assistantContent.length)
                continue // Pular processamento de linhas
              }
            }

            // Processar linhas SSE ou texto puro
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Manter última linha incompleta

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                // Tentar parsear como JSON (metadados) ou usar como conteúdo
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.type === 'metadata') continue // Já processado
                  if (data.type === 'memory_created' && data.data) {
                    // Notificação de nova memória criada
                    toast({
                      title: '🧠 Nova memória salva',
                      description: data.data.message || `${data.data.count} nova${data.data.count > 1 ? 's' : ''} memória${data.data.count > 1 ? 's' : ''} criada${data.data.count > 1 ? 's' : ''}`,

                    })
                    continue
                  }
                } catch (e) {
                  // Não é JSON, usar como conteúdo
                  const content = line.slice(6) // Remover 'data: '

                  // Verificar se estamos no meio de uma URL base64 (dentro de markdown image)
                  const hasImageStartBase64 = assistantContent.includes('![Imagem gerada](data:')
                  const hasImageEndBase64 = assistantContent.match(/!\[Imagem gerada\]\(data:[^)]+\)/)
                  const isBase64Content = content.match(/^[A-Za-z0-9+/=\s]+$/) && content.length > 50

                  const isInBase64Url = hasImageStartBase64 && !hasImageEndBase64 &&
                    (assistantContent.includes('base64,') || isBase64Content)

                  // Verificar se estamos no meio de uma URL HTTP (dentro de markdown image ou video)
                  const hasImageStartHttp = (assistantContent.includes('![Imagem gerada](https://') ||
                    assistantContent.includes('![Imagemgerada](https://') ||
                    assistantContent.includes('![Imagem gerada](http://') ||
                    assistantContent.includes('![Imagemgerada](http://') ||
                    (assistantContent.includes('![Imagem') && (assistantContent.includes('https://') || assistantContent.includes('http://'))))
                  const hasImageEndHttp = assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) ||
                    assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/)

                  const hasVideoStartHttp = (assistantContent.includes('![Vídeo gerado](https://') ||
                    assistantContent.includes('![Vídeogerado](https://') ||
                    assistantContent.includes('![Vídeo gerado](http://') ||
                    assistantContent.includes('![Vídeogerado](http://') ||
                    (assistantContent.includes('![Vídeo') && (assistantContent.includes('https://') || assistantContent.includes('http://'))))
                  const hasVideoEndHttp = assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) ||
                    assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/)

                  const isInHttpUrl = (hasImageStartHttp && !hasImageEndHttp) || (hasVideoStartHttp && !hasVideoEndHttp)

                  if (isInBase64Url) {
                    // Estamos no meio de uma URL base64, adicionar sem quebra e sem espaços
                    assistantContent += content.replace(/\s+/g, '')
                    console.log('[LAB-IA][STREAM] Conteúdo base64 recebido (primeiros 50 chars):', content.substring(0, 50))
                  } else {
                    // FIX: Se o backend envia linhas via SSE mas esquece o \n final no JSON content
                    // Verificamos se o conteúdo recebido é "grande" o suficiente para ser uma linha (token stream geralmente é pequeno)
                    // E se não termina com espaço ou \n.
                    // Isso é arriscado para tokens, mas se o log mostra linhas inteiras chegando, é necessário.

                    if (content.length > 5 && !content.endsWith('\n') && !content.endsWith(' ')) {
                      assistantContent += content + '\n'
                    } else {
                      assistantContent += content
                    }
                    console.log('[LAB-IA][STREAM] Conteúdo recebido:', content.substring(0, 100))
                  }
                }
              } else if (line.trim() && !line.startsWith(':')) {
                // Conteúdo normal (não SSE)

                // Verificar se esta linha começa com markdown image e data URL
                // Aceitar tanto "Imagem gerada" quanto "Imagemgerada" (sem espaço)
                const startsWithImageMarkdownBase64 = line.trim().match(/^!\[Imagem\s?gerada\]\(data:/)

                // Verificar se esta linha começa com markdown image/video e URL HTTP
                const startsWithImageMarkdownHttp = line.trim().match(/^!\[Imagem\s?gerada\]\(https?:\/\//) ||
                  line.trim().match(/^!\[Imagem\s?\d+\]\(https?:\/\//) ||
                  (line.trim().includes('![Imagem') && (line.trim().includes('https://') || line.trim().includes('http://')))
                const startsWithVideoMarkdownHttp = line.trim().match(/^!\[Vídeo\s?gerado\]\(https?:\/\//) ||
                  line.trim().match(/^!\[Vídeo\s?\d+\]\(https?:\/\//) ||
                  (line.trim().includes('![Vídeo') && (line.trim().includes('https://') || line.trim().includes('http://')))

                // Verificar se estamos no meio de uma URL base64 (dentro de markdown image)
                const hasImageStartBase64 = assistantContent.match(/!\[Imagem\s?gerada\]\(data:/)
                const hasImageEndBase64 = assistantContent.match(/!\[Imagem\s?gerada\]\(data:[^)]+\)/)

                // Verificar se estamos no meio de uma URL HTTP (dentro de markdown image ou video)
                const hasImageStartHttp = assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\//) ||
                  assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\//) ||
                  (assistantContent.includes('![Imagem') && (assistantContent.includes('https://') || assistantContent.includes('http://')))
                const hasImageEndHttp = assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) ||
                  assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/)

                const hasVideoStartHttp = assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\//) ||
                  assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\//) ||
                  (assistantContent.includes('![Vídeo') && (assistantContent.includes('https://') || assistantContent.includes('http://')))
                const hasVideoEndHttp = assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) ||
                  assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/)

                // Verificar se já passamos do prefixo "data:image/...;base64," e estamos no conteúdo base64
                const base64StartIndex = assistantContent.indexOf('base64,')
                const isInBase64Content = base64StartIndex !== -1 && !hasImageEndBase64

                // Verificar se a linha contém apenas caracteres base64 válidos (após base64,)
                // Base64 válido: A-Z, a-z, 0-9, +, /, = e espaços/quebras de linha
                const isBase64Line = line.trim().match(/^[A-Za-z0-9+/=\s]+$/) &&
                  line.trim().length > 50 &&
                  !line.trim().match(/[^A-Za-z0-9+/=\s]/)

                // Verificar se a linha continua uma URL base64 que já começou
                // Só continuar se estivermos realmente dentro do conteúdo base64 (após base64,)
                const continuesBase64Url = isInBase64Content && isBase64Line

                if (startsWithImageMarkdownBase64) {
                  // Começou uma URL base64, marcar flag e adicionar
                  isAccumulatingBase64 = true
                  isAccumulatingHttpUrl = false
                  const cleanLine = line.trim().replace(/\s+/g, '')
                  assistantContent += cleanLine
                  console.log('[LAB-IA][STREAM] Iniciando acumulação base64:', cleanLine.substring(0, 50))
                } else if ((startsWithImageMarkdownHttp && !hasImageEndHttp) || (startsWithVideoMarkdownHttp && !hasVideoEndHttp)) {
                  // Começou uma URL HTTP (imagem ou vídeo), marcar flag e adicionar
                  isAccumulatingHttpUrl = true
                  isAccumulatingBase64 = false
                  const cleanLine = line.trim().replace(/\n/g, '').replace(/\r/g, '')
                  assistantContent += cleanLine
                  console.log('[LAB-IA][STREAM] Iniciando acumulação HTTP:', cleanLine.substring(0, 100))
                } else if (isAccumulatingBase64) {
                  // Estamos acumulando base64
                  // Verificar se encontramos o fechamento nesta linha
                  if (line.includes(')')) {
                    // Encontramos o fechamento, adicionar até o fechamento e parar
                    const closingIndex = line.indexOf(')')
                    const beforeClose = line.substring(0, closingIndex + 1).trim().replace(/\s+/g, '')
                    assistantContent += beforeClose
                    isAccumulatingBase64 = false
                    console.log('[LAB-IA][STREAM] Fechamento de URL base64 encontrado')

                    // Adicionar o resto da linha como conteúdo normal (se houver)
                    if (line.length > closingIndex + 1) {
                      assistantContent += line.substring(closingIndex + 1)
                      console.log('[LAB-IA][STREAM] Conteúdo após URL base64:', line.substring(closingIndex + 1).substring(0, 100))
                    }
                  } else if (continuesBase64Url) {
                    // Ainda estamos no conteúdo base64 válido, adicionar sem quebra e sem espaços
                    const cleanLine = line.trim().replace(/\s+/g, '')
                    assistantContent += cleanLine
                    console.log('[LAB-IA][STREAM] Continuando base64:', cleanLine.substring(0, 50))
                  } else {
                    // Não é mais base64 válido, mas ainda não encontramos o fechamento
                    // Isso pode acontecer se a URL foi quebrada incorretamente
                    // Tentar encontrar o fechamento no buffer acumulado
                    const currentContent = assistantContent
                    const lastBase64Index = currentContent.lastIndexOf('base64,')
                    if (lastBase64Index !== -1) {
                      // Procurar por fechamento após base64,
                      const afterBase64 = currentContent.substring(lastBase64Index + 7)
                      const closeIndex = afterBase64.indexOf(')')
                      if (closeIndex !== -1) {
                        // Fechamento encontrado no conteúdo acumulado, parar acumulação
                        isAccumulatingBase64 = false
                        console.log('[LAB-IA][STREAM] Fechamento encontrado no conteúdo acumulado')
                      }
                    }

                    // Se ainda estamos acumulando, adicionar como texto normal
                    if (!isAccumulatingBase64) {
                      assistantContent += line
                      console.log('[LAB-IA][STREAM] Conteúdo após URL base64:', line.substring(0, 100))
                    } else {
                      // Ainda acumulando, adicionar como base64 (pode estar quebrado)
                      const cleanLine = line.trim().replace(/\s+/g, '')
                      assistantContent += cleanLine
                      console.log('[LAB-IA][STREAM] Continuando base64 (possível quebra):', cleanLine.substring(0, 50))
                    }
                  }
                } else if (isAccumulatingHttpUrl) {
                  // Estamos acumulando HTTP
                  // Verificar se encontramos o fechamento nesta linha
                  if (line.includes(')')) {
                    // Encontramos o fechamento, adicionar até o fechamento e parar
                    const closingIndex = line.indexOf(')')
                    const beforeClose = line.substring(0, closingIndex + 1).replace(/\n/g, '').replace(/\r/g, '')
                    assistantContent += beforeClose
                    isAccumulatingHttpUrl = false
                    console.log('[LAB-IA][STREAM] Fechamento de URL HTTP encontrado')

                    // Adicionar o resto da linha como conteúdo normal (se houver)
                    if (line.length > closingIndex + 1) {
                      assistantContent += line.substring(closingIndex + 1)
                      console.log('[LAB-IA][STREAM] Conteúdo após URL HTTP:', line.substring(closingIndex + 1).substring(0, 100))
                    }
                  } else {
                    // Ainda estamos acumulando HTTP, adicionar sem quebras de linha
                    const cleanLine = line.replace(/\n/g, '').replace(/\r/g, '')
                    assistantContent += cleanLine
                    console.log('[LAB-IA][STREAM] Continuando HTTP:', cleanLine.substring(0, 100))
                  }
                } else {
                  assistantContent += line
                  console.log('[LAB-IA][STREAM] Conteúdo direto:', line.substring(0, 100))
                }
              }
            }

            // Verificar se há URL base64 completa antes de atualizar
            const hasImageMarkdownBase64 = assistantContent.match(/!\[Imagem\s?gerada\]\(data:/)
            if (hasImageMarkdownBase64) {
              // Tentar encontrar URL completa (pode ter espaço ou não no texto)
              const imageMatch = assistantContent.match(/!\[Imagem\s?gerada\]\(data:[^)]+\)/)
              if (imageMatch) {
                console.log('[LAB-IA][STREAM] URL base64 completa encontrada! Tamanho:', imageMatch[0].length)
                console.log('[LAB-IA][STREAM] Primeiros 100 chars da URL:', imageMatch[0].substring(0, 100))
                console.log('[LAB-IA][STREAM] Últimos 50 chars da URL:', imageMatch[0].substring(Math.max(0, imageMatch[0].length - 50)))
              } else {
                // Verificar se temos o início mas não o fechamento
                const base64Start = assistantContent.indexOf('base64,')
                if (base64Start !== -1) {
                  const afterBase64 = assistantContent.substring(base64Start + 7)
                  const closeIndex = afterBase64.indexOf(')')
                  if (closeIndex === -1) {
                    console.warn('[LAB-IA][STREAM] URL base64 incompleta! Não encontrou fechamento após base64,')
                    console.warn('[LAB-IA][STREAM] Conteúdo após base64, (primeiros 200 chars):', afterBase64.substring(0, 200))
                  }
                } else {
                  console.warn('[LAB-IA][STREAM] URL base64 incompleta! Não encontrou base64,')
                  console.warn('[LAB-IA][STREAM] Conteúdo atual:', assistantContent.substring(0, 500))
                }
              }
            }

            // Verificar se há URL HTTP completa antes de atualizar (imagens ou vídeos)
            const hasImageMarkdownHttp = assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\//) ||
              assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\//)
            const hasVideoMarkdownHttp = assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\//) ||
              assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\//)
            if (hasImageMarkdownHttp) {
              // Tentar encontrar URL completa (pode ter espaço ou não no texto)
              const imageMatchHttp = assistantContent.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) ||
                assistantContent.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/)
              if (imageMatchHttp) {
                console.log('[LAB-IA][STREAM] URL HTTP completa encontrada! Tamanho:', imageMatchHttp[0].length)
                console.log('[LAB-IA][STREAM] URL completa:', imageMatchHttp[0])
              } else {
                console.warn('[LAB-IA][STREAM] URL HTTP incompleta! Não encontrou fechamento')
                console.warn('[LAB-IA][STREAM] Conteúdo atual:', assistantContent.substring(0, 500))
              }
            }
            if (hasVideoMarkdownHttp) {
              // Tentar encontrar URL completa de vídeo (pode ter espaço ou não no texto)
              const videoMatchHttp = assistantContent.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) ||
                assistantContent.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/)
              if (videoMatchHttp) {
                console.log('[LAB-IA][STREAM] URL HTTP de vídeo completa encontrada! Tamanho:', videoMatchHttp[0].length)
                console.log('[LAB-IA][STREAM] URL completa:', videoMatchHttp[0])
              } else {
                console.warn('[LAB-IA][STREAM] URL HTTP de vídeo incompleta! Não encontrou fechamento')
                console.warn('[LAB-IA][STREAM] Conteúdo atual:', assistantContent.substring(0, 500))
              }
            }

            // Atualizar mensagem em tempo real
            setMessages((prev) => {
              const existingIndex = prev.findIndex((m) => m.id === tempAssistantId)
              if (existingIndex !== -1) {
                const updated = [...prev]
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  content: assistantContent,
                  metadata: messageMetadata,
                }
                return updated
              }
              return [
                ...prev,
                {
                  id: tempAssistantId,
                  role: 'assistant' as const,
                  content: assistantContent,
                  created_at: new Date().toISOString(),
                  metadata: messageMetadata,
                },
              ]
            })

            // Scroll automático quando a primeira parte da resposta chega
            if (isFirstChunk) {
              setTimeout(() => {
                if (chatContainerRef.current) {
                  chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                  })
                }
              }, 100)
              isFirstChunk = false
            }

            // Scroll suave durante o streaming (aproximadamente)
            if (assistantContent.length % 50 === 0) {
              setTimeout(() => {
                if (chatContainerRef.current) {
                  chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                  })
                }
              }, 50)
            }
          }
        } else {
          // Resposta completa (não-streaming)
          const data = await response.json()
          assistantContent = data.content || ''

          setMessages((prev) => [
            ...prev,
            {
              id: tempAssistantId,
              role: 'assistant' as const,
              content: assistantContent,
              created_at: new Date().toISOString(),
              metadata: data.metadata ? {
                provider: data.provider,
                model: data.model,
                autoSelected: data.metadata.autoSelected,
                originalProvider: data.metadata.originalProvider,
                originalModel: data.metadata.originalModel,
                taskCategory: data.metadata.taskCategory ?? null,
              } : undefined,
            },
          ])
        }
      }

      // Scroll final após completar a resposta
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }
      }, 200)

      // Salvar mensagem completa do assistente (apenas se não foi criada como placeholder)
      if (!assistantMessageId) {
        const { error: msgError } = await supabase.from('lab_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantContent,
        })

        if (msgError) console.error('Erro ao salvar mensagem:', msgError)
      } else {
        // Se já existe a mensagem (placeholder), apenas atualizar o conteúdo
        const { error: updateError } = await supabase
          .from('lab_messages')
          .update({ content: assistantContent })
          .eq('id', assistantMessageId)

        if (updateError) console.error('Erro ao atualizar mensagem:', updateError)
      }

      // Atualizar conversas
      await loadConversations()
    } catch (error: any) {
      console.error('Erro no chat:', error)

      // Se foi cancelamento, não mostrar mensagem de erro
      if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log('[LAB-IA] Pipeline cancelado (já tratado anteriormente)')
        setIsCanceling(false)
        return
      }

      // Verificar se é erro de autenticação
      const errorMessage = error.message || 'Erro desconhecido'
      const isAuthError = errorMessage.includes('Não autenticado') ||
        errorMessage.includes('autenticado') ||
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized')

      if (isAuthError) {
        toast({
          title: 'Erro de autenticação',
          description: 'Sua sessão expirou. Por favor, faça login novamente.',
          variant: 'destructive',
        })
        // Remover mensagem do usuário que falhou
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id))
      } else {
        toast({
          title: 'Erro ao processar mensagem',
          description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage,
          variant: 'destructive',
        })
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `❌ Desculpe, ocorreu um erro ao processar sua mensagem: ${errorMessage}`,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      setLoadingStartTime(null)
      setLoadingElapsedSeconds(0)
      setIsCanceling(false)
      // Aguardar um pouco antes de limpar progresso para mostrar resultado final
      // Usar ref para poder cancelar se uma nova execução começar
      if (!abortControllerRef.current?.signal.aborted) {
        progressCleanupTimeoutRef.current = setTimeout(() => {
          setPipelineProgress(null)
          setPipelineSteps(new Map())
          progressCleanupTimeoutRef.current = null
        }, 2000)
      }
    }
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      // Deletar mensagens
      await supabase.from('lab_messages').delete().eq('conversation_id', id)

      // Deletar conversa
      await supabase.from('lab_conversations').delete().eq('id', id)

      // Recarregar lista
      await loadConversations()

      // Se era a conversa atual, limpar
      if (currentConversationId === id) {
        setCurrentConversationId(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Erro ao deletar:', error)
    }
  }

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('lab_conversations')
        .update({ title: newTitle })
        .eq('id', id)

      if (error) throw error

      // Recarregar lista
      await loadConversations()
    } catch (error) {
      console.error('Erro ao renomear:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível renomear a conversa',
        variant: 'destructive',
      })
    }
  }

  const activateAgent = (agent: (AgentSummary & { alias?: string | null }) | null, options?: { silent?: boolean }) => {
    if (!agent) return
    const agentForStore = {
      id: agent.id,
      name: agent.name,
      description: agent.description || '',
      icon: agent.icon || '🤖',
      type: (agent.type as 'llm' | 'automation') || 'llm',
      provider: agent.provider,
      model: agent.model,
      category: agent.category,
      prompt: '',
      active: true,
    }

    setSelectedAgent(agentForStore as any)
    setSelectedPipeline(null)
    if (agent.provider) {
      setProvider(agent.provider)
    }
    if (agent.model) {
      setModel(agent.model)
    }
    registerAgentUsage(agent)
    if (!options?.silent) {
      toast({
        title: `${agent.icon || '🤖'} ${(agent.alias || agent.name).trim()} selecionado`,
        description: 'Envie uma mensagem para começar a usar este agente.',
      })
    }
  }

  const handleExploreItemClick = (item: ExploreItem) => {
    if (item.agent) {
      activateAgent(item.agent)
      setAgentExplorerOpen(false)
      return
    }

    if (item.agentId) {
      const agentFromStatic = getAgentById(item.agentId)
      if (agentFromStatic) {
        activateAgent({
          id: agentFromStatic.id,
          name: agentFromStatic.name,
          description: agentFromStatic.description,
          icon: agentFromStatic.icon,
          category: agentFromStatic.category,
          type: agentFromStatic.type,
        })
        setAgentExplorerOpen(false)
        return
      }
    }

    if (item.href) {
      router.push(item.href)
      setAgentExplorerOpen(false)
    }
  }

  const renameAgentShortcut = (agentId: string, newAlias: string | null) => {
    setAgentShortcuts((prev) => {
      const next = prev.map((item) =>
        item.id === agentId ? { ...item, alias: newAlias || undefined } : item
      )
      persistAgentShortcuts(next)
      return next
    })
  }

  const removeAgentShortcut = (agentId: string) => {
    setAgentShortcuts((prev) => {
      const next = prev.filter((item) => item.id !== agentId)
      persistAgentShortcuts(next)
      return next
    })
  }

  const toggleFavoriteAgentShortcut = (agentId: string, isFavorite: boolean) => {
    setAgentShortcuts((prev) => {
      const next = prev.map((item) =>
        item.id === agentId ? { ...item, isFavorite } : item
      )
      persistAgentShortcuts(next)
      return next
    })
  }

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa estar logado para acessar o Laboratório da IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/auth/login">Fazer Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sidebarContent = (
    <Sidebar
      conversations={conversations}
      currentConversationId={currentConversationId || undefined}
      onNewChat={() => {
        createNewConversation()
        setIsSidebarOpen(false)
      }}
      onSelectConversation={(id) => {
        loadConversation(id)
        setIsSidebarOpen(false)
      }}
      onDeleteConversation={handleDeleteConversation}
      onRenameConversation={handleRenameConversation}
      onToggleFavorite={handleToggleConversationFavorite}
      onExploreAgents={() => {
        setAgentExplorerOpen(true)
        setIsSidebarOpen(false)
      }}
      userAgents={recentAgents.map((agent) => {
        const shortcut = agentShortcuts.find((item) => item.id === agent.id)
        return {
          id: agent.id,
          name: agent.alias || agent.name,
          icon: agent.icon,
          isFavorite: shortcut?.isFavorite || false,
        }
      })}
      onSelectUserAgent={(agentId) => {
        const agent = allAgents.find((item) => item.id === agentId) || resolveAgentSummary(agentId || '')
        if (agent) {
          activateAgent(agent, { silent: true })
          const shortcut = agentShortcuts.find((item) => item.id === agent.id)
          setAgentExplorerOpen(false)
          setIsSidebarOpen(false)
          toast({
            title: `${agent.icon || '🤖'} ${(shortcut?.alias || agent.name).trim()} pronto`,
            description: 'Agente aplicado ao chat.',
          })
        } else {
          toast({
            title: 'Agente indisponível',
            description: 'Não encontramos esse agente na lista atual.',
            variant: 'destructive',
          })
        }
      }}
      onRenameUserAgent={(agentId, newName) => {
        renameAgentShortcut(agentId, newName)
      }}
      onDeleteUserAgent={(agentId) => {
        if (window.confirm('Deseja remover este agente dos seus atalhos?')) {
          removeAgentShortcut(agentId)
        }
      }}
      onToggleFavoriteUserAgent={(agentId, isFavorite) => {
        toggleFavoriteAgentShortcut(agentId, isFavorite)
      }}
    />
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar Desktop */}
      <div className="hidden md:block w-80 flex-shrink-0 overflow-hidden" style={{ maxWidth: '320px', minWidth: '320px' }}>
        {sidebarContent}
      </div>

      {/* Sidebar Mobile */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-80 p-0">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header com seletor de modelo e agente */}
        <div className="border-b p-2 md:p-4">
          {/* Mobile Header */}
          <div className="flex md:hidden items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate">Lab IA</h1>
                {selectedAgent && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs">{selectedAgent.icon}</span>
                    <span className="text-xs text-muted-foreground truncate">{selectedAgent.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {comparisonMode ? (
                <DualModelSelector
                  modelA={modelA}
                  modelB={modelB}
                  onModelAChange={(p, m) => setModelA({ provider: p, model: m })}
                  onModelBChange={(p, m) => setModelB({ provider: p, model: m })}
                />
              ) : (
                <ChatModelSelector
                  provider={provider}
                  model={model}
                  onChange={(newProvider, newModel) => {
                    setProvider(newProvider)
                    setModel(newModel)
                  }}
                />
              )}
              <ModelComparisonToggle
                enabled={comparisonMode}
                onToggle={(enabled) => {
                  setComparisonMode(enabled)
                  if (!enabled) {
                    // Limpar votos ao desativar modo comparação
                    setComparisonVotes({})
                  }
                }}
              />
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Sparkles className="h-6 w-6 text-primary flex-shrink-0" />
                <h1 className="text-2xl font-bold">Laboratório da IA</h1>
                {selectedAgent && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <span>{selectedAgent.icon}</span>
                    <span>{selectedAgent.name}</span>
                  </div>
                )}
                {selectedPipeline && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <span>🔗</span>
                    <span>{selectedPipeline.name}</span>
                  </div>
                )}
                {/* Gamification Indicators */}
                {stats && (
                  <Link
                    href="/profile/dashboard"
                    className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <PointsDisplay
                      points={stats.total_xp}
                      showIcon
                      size="sm"
                      variant="compact"
                    />
                    <LevelBadge
                      level={stats.current_level}
                      size="sm"
                      showIcon
                    />
                    <StreakDisplay
                      currentStreak={stats.current_streak}
                      size="sm"
                      variant="compact"
                    />
                  </Link>
                )}
              </div>
            </div>
            {/* Linha de controles: Modelos > Comparar > Pipelines > Preferências > Histórico > Dashboard */}
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {/* 1. Seleção de modelos */}
              {comparisonMode ? (
                <DualModelSelector
                  modelA={modelA}
                  modelB={modelB}
                  onModelAChange={(p, m) => setModelA({ provider: p, model: m })}
                  onModelBChange={(p, m) => setModelB({ provider: p, model: m })}
                />
              ) : (
                <ChatModelSelector
                  provider={provider}
                  model={model}
                  onChange={(newProvider, newModel) => {
                    setProvider(newProvider)
                    setModel(newModel)
                  }}
                />
              )}

              {/* 2. Toggle Comparar Modelos */}
              <ModelComparisonToggle
                enabled={comparisonMode}
                onToggle={(enabled) => {
                  setComparisonMode(enabled)
                  if (!enabled) {
                    setComparisonVotes({})
                  }
                }}
              />

              {/* 3. Pipelines (apenas para admin) */}
              {isAdmin && (
                <PipelineSelector
                  selectedPipelineId={selectedPipeline?.id}
                  onSelect={(pipeline) => {
                    setSelectedPipeline(pipeline)
                    // Se pipeline selecionado, remover agente único (mutuamente exclusivo)
                    if (pipeline) {
                      setSelectedAgent(null)
                    }
                  }}
                />
              )}

              {/* 4. Preferências */}
              <RoutingPreferencesDialog
                preferences={routingPreferences}
                onPreferencesChange={(prefs) => {
                  setRoutingPreferences(prefs)
                  setIntelligentRoutingEnabled(prefs.intelligentRoutingEnabled)
                }}
              />

              {/* 4.5. Configurações de Memória */}
              <MemorySettingsDialog />

              {/* 5. Histórico */}
              <Link href="/ai-lab/pipelines/history">
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
              </Link>

              {/* 6. Dashboard (apenas para admin) */}
              {isAdmin && (
                <Link href="/ai-lab/admin">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto" ref={chatContainerRef}>
          {isAgentExplorerOpen ? (
            <div className="min-h-full">
              <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-8 space-y-4 md:space-y-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs md:text-sm uppercase tracking-wide">
                      <Compass className="h-3 w-3 md:h-4 md:w-4" /> Gerenciador de Agentes
                    </div>
                    <h2 className="mt-2 text-xl md:text-3xl font-bold">Escolha o agente ideal para sua tarefa</h2>
                    <p className="text-muted-foreground text-sm md:text-base mt-1">
                      Visualize agentes predefinidos pela WE ou reutilize os seus favoritos para acelerar suas operações.
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setAgentExplorerOpen(false)}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">Fechar gerenciador</span>
                  </Button>
                </div>

                <Input
                  placeholder="Buscar agentes por nome, categoria ou descrição"
                  value={agentSearch}
                  onChange={(event) => setAgentSearch(event.target.value)}
                  className="bg-background text-sm md:text-base"
                />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Predefinidos pela WE
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Seleção oficial com modelos otimizados para operações médicas.
                    </p>
                  </div>
                  {isAdmin && (
                    <Link href="/ai-lab/admin/agents">
                      <Button variant="outline" size="sm" className="gap-2">
                        + Novo Agente
                      </Button>
                    </Link>
                  )}
                </div>

                {hasSearch ? (
                  searchResults.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-6 text-center text-muted-foreground text-sm">
                        Nenhum resultado encontrado.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {searchResults.map((item) => (
                        <Card
                          key={item.id}
                          onClick={() => handleExploreItemClick(item)}
                          className="cursor-pointer transition hover:shadow-lg"
                        >
                          <CardContent className="p-5 space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                                {typeof item.icon === 'string' ? item.icon : item.icon}
                              </div>
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold leading-tight">{item.title}</h4>
                                  {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {item.description}
                                </p>
                                {item.agent?.usage_instructions && (
                                  <div className="mt-2 pt-2 border-t border-border/50">
                                    <p className="text-xs font-medium text-foreground mb-1">📖 Como usar:</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {item.agent.usage_instructions}
                                    </p>
                                  </div>
                                )}
                                {item.agent?.expected_result && (
                                  <div className="pt-1">
                                    <p className="text-xs font-medium text-foreground mb-1">✅ Resultado esperado:</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {item.agent.expected_result}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" className="w-full justify-between">
                              {item.agentId ? 'Selecionar agente' : 'Abrir recurso'}
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )
                ) : (
                  <>
                    {agentsLoading ? (
                      <Card>
                        <CardContent className="p-6 text-center text-muted-foreground text-sm">
                          Carregando agentes...
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredPredefinedItems.map((item) => (
                          <Card
                            key={item.id}
                            onClick={() => handleExploreItemClick(item)}
                            className="cursor-pointer transition hover:shadow-lg"
                          >
                            <CardContent className="p-5 space-y-4">
                              <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                                  {typeof item.icon === 'string' ? item.icon : item.icon}
                                </div>
                                <div className="space-y-2 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold leading-tight">{item.title}</h4>
                                    {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    {item.description}
                                  </p>
                                  {item.agent?.usage_instructions && (
                                    <div className="mt-2 pt-2 border-t border-border/50">
                                      <p className="text-xs font-medium text-foreground mb-1">📖 Como usar:</p>
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {item.agent.usage_instructions}
                                      </p>
                                    </div>
                                  )}
                                  {item.agent?.expected_result && (
                                    <div className="pt-1">
                                      <p className="text-xs font-medium text-foreground mb-1">✅ Resultado esperado:</p>
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {item.agent.expected_result}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" className="w-full justify-between">
                                Selecionar agente
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Meus agentes
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Personalizados ou utilizados recentemente nesta conta.
                          </p>
                        </div>
                      </div>
                      {recentItems.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-5 text-sm text-muted-foreground text-center">
                            Você ainda não usou nenhum agente personalizado. Selecione um predefinido ou crie o seu.
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                          {recentItems.map((item) => (
                            <Card
                              key={item.id}
                              onClick={() => handleExploreItemClick(item)}
                              className="cursor-pointer transition hover:shadow-lg"
                            >
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
                                    {typeof item.icon === 'string' ? item.icon : item.icon}
                                  </div>
                                  <div className="space-y-2 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold leading-tight">{item.agent?.alias || item.title}</h4>
                                      {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      {item.description}
                                    </p>
                                    {item.agent?.usage_instructions && (
                                      <div className="mt-2 pt-2 border-t border-border/50">
                                        <p className="text-xs font-medium text-foreground mb-1">📖 Como usar:</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                          {item.agent.usage_instructions}
                                        </p>
                                      </div>
                                    )}
                                    {item.agent?.expected_result && (
                                      <div className="pt-1">
                                        <p className="text-xs font-medium text-foreground mb-1">✅ Resultado esperado:</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                          {item.agent.expected_result}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" className="w-full justify-between">
                                  Selecionar agente
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="px-2 md:px-4 pb-4">
              {/* Instruções iniciais quando o chat está vazio */}
              {messages.length === 0 && !loading && !selectedPipeline && !selectedAgent && (
                <EmptyChatState
                  provider={provider}
                  model={model}
                  comparisonMode={comparisonMode}
                  modelA={comparisonMode ? modelA : undefined}
                  modelB={comparisonMode ? modelB : undefined}
                />
              )}

              {/* Estimativa de custo antes de executar pipeline */}
              {selectedPipeline && !loading && messages.length === 0 && (
                <div className="py-4">
                  <CostEstimateCard
                    pipelineId={selectedPipeline.id!}
                    inputMessages={messages.filter(m => m.role === 'user')}
                  />
                </div>
              )}

              {pipelineProgress && selectedPipeline && (
                <div ref={pipelineProgressRef} className="py-4">
                  <PipelineProgress
                    pipelineName={selectedPipeline.name}
                    totalSteps={pipelineProgress.total}
                    currentStep={pipelineProgress.current}
                    steps={Array.from(pipelineSteps.values()).sort((a, b) => a.order - b.order)}
                    onCancel={handleCancelPipeline}
                    isCanceling={isCanceling}
                  />
                </div>
              )}
              {messages.map((message, index) => {
                // Verificar se é uma mensagem de comparação (lado A)
                if (message.metadata?.isComparison && message.metadata?.comparisonSide === 'A') {
                  // Procurar a mensagem correspondente (lado B) usando comparisonId
                  const comparisonId = (message.metadata as any)?.comparisonId
                  let messageB: Message | undefined

                  if (comparisonId) {
                    // Procurar usando comparisonId (mais preciso)
                    messageB = messages.find(
                      m => m.metadata?.isComparison &&
                        m.metadata?.comparisonSide === 'B' &&
                        (m.metadata as any)?.comparisonId === comparisonId
                    )
                  } else {
                    // Fallback: procurar nas próximas mensagens
                    for (let i = index + 1; i < Math.min(index + 4, messages.length); i++) {
                      const candidate = messages[i]
                      if (
                        candidate.metadata?.isComparison &&
                        candidate.metadata?.comparisonSide === 'B'
                      ) {
                        messageB = candidate
                        break
                      }
                    }

                    // Se não encontrou nas próximas, procurar em qualquer lugar após esta mensagem
                    if (!messageB) {
                      messageB = messages.slice(index + 1).find(
                        m => m.metadata?.isComparison && m.metadata?.comparisonSide === 'B'
                      )
                    }
                  }

                  if (messageB) {
                    console.log('[LAB-IA][RENDER] Passando dados para ComparisonMessageBubble:', {
                      responseA: {
                        provider: message.metadata!.provider!,
                        model: message.metadata!.model!,
                        content: message.content?.substring(0, 100),
                        contentLength: message.content?.length,
                        id: message.id,
                      },
                      responseB: {
                        provider: messageB.metadata!.provider!,
                        model: messageB.metadata!.model!,
                        content: messageB.content?.substring(0, 100),
                        contentLength: messageB.content?.length,
                        id: messageB.id,
                      },
                    })
                    return (
                      <ComparisonMessageBubble
                        key={message.id}
                        responseA={{
                          provider: message.metadata!.provider!,
                          model: message.metadata!.model!,
                          content: message.content || '',
                          id: message.id,
                          latency: (message.metadata as any)?.latency,
                          cost: (message.metadata as any)?.cost,
                        }}
                        responseB={{
                          provider: messageB.metadata!.provider!,
                          model: messageB.metadata!.model!,
                          content: messageB.content || '',
                          id: messageB.id,
                          latency: (messageB.metadata as any)?.latency,
                          cost: (messageB.metadata as any)?.cost,
                        }}
                        onVote={(winner) => handleVote(
                          message.id,
                          winner,
                          {
                            provider: message.metadata!.provider!,
                            model: message.metadata!.model!,
                          },
                          {
                            provider: messageB.metadata!.provider!,
                            model: messageB.metadata!.model!,
                          }
                        )}
                        votedFor={comparisonVotes[message.id]}
                      />
                    )
                  }

                  // Se não encontrou o par, renderizar apenas A (pode estar carregando ainda)
                  return (
                    <div key={message.id} className="my-4">
                      <div className="text-xs text-muted-foreground mb-2">
                        {message.metadata?.provider} - {message.metadata?.model} (Aguardando resposta B...)
                      </div>
                      <MessageBubble
                        id={message.id}
                        role={message.role}
                        content={message.content || 'Aguardando resposta...'}
                        timestamp={message.created_at}
                        isFavorite={message.is_favorite || false}
                        onToggleFavorite={handleToggleMessageFavorite}
                        attachments={message.attachments}
                        metadata={message.metadata}
                        pendingVideoOperation={pendingVideoOperations[message.id]}
                        onCheckVideoStatus={() => handleCheckVideoStatus(message.id)}
                        isCheckingVideoStatus={checkingVideoStatus === message.id}
                      />
                    </div>
                  )
                }

                // Não renderizar se for parte de comparação lado B (já renderizado acima)
                if (message.metadata?.isComparison && message.metadata?.comparisonSide === 'B') {
                  return null
                }

                // Renderizar normalmente
                return (
                  <MessageBubble
                    key={message.id}
                    id={message.id}
                    role={message.role}
                    content={message.content}
                    timestamp={message.created_at}
                    isFavorite={message.is_favorite || false}
                    onToggleFavorite={handleToggleMessageFavorite}
                    attachments={message.attachments}
                    metadata={message.metadata}
                    onProvideFeedback={message.metadata?.autoSelected ? (feedback) => handleModelFeedback(message.id, feedback) : undefined}
                    isFeedbackSubmitting={feedbackSubmittingId === message.id}
                    pendingVideoOperation={pendingVideoOperations[message.id]}
                    onCheckVideoStatus={() => handleCheckVideoStatus(message.id)}
                    isCheckingVideoStatus={checkingVideoStatus === message.id}
                  />
                )
              })}
              {loading && !pipelineProgress && (
                <>
                  <TypingIndicator className="my-4" />
                  {loadingElapsedSeconds > 10 && (
                    <LongMessageWarning
                      elapsedSeconds={loadingElapsedSeconds}
                      className="mx-4 my-2"
                    />
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {userRole === 'guest' ? (
          <div className="border-t p-4 bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex-1 px-4 py-3 rounded-lg border bg-background/50 opacity-60 cursor-not-allowed">
                Usuários Guest não podem usar o Laboratório de IA. Faça upgrade para conta USER ou ADMIN.
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t bg-background">
            {/* Card de Recomendação de Modelo */}
            {modelRecommendation && intelligentRoutingEnabled && !selectedAgent && !selectedPipeline && (
              <div className="px-2 md:px-4 pt-4 pb-2 max-w-3xl mx-auto">
                <ModelRecommendationCard
                  recommendation={modelRecommendation.recommendation}
                  alternatives={modelRecommendation.alternatives}
                  currentProvider={provider}
                  currentModel={model}
                  onAccept={async (newProvider, newModel) => {
                    setProvider(newProvider)
                    setModel(newModel)
                    setModelRecommendation(null) // Esconder ao aceitar
                    // Limpar timeout de recomendações
                    if (recommendationTimeoutRef.current) {
                      clearTimeout(recommendationTimeoutRef.current)
                    }

                    // Salvar no histórico
                    try {
                      const { data: sessionData } = await supabase.auth.getSession()
                      const token = sessionData?.session?.access_token

                      if (token) {
                        const lastUserMessage = messages.filter(m => m.role === 'user').pop()
                        await fetch('/api/lab-ia/routing/recommendations-history', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            originalProvider: provider,
                            originalModel: model,
                            recommendedProvider: newProvider,
                            recommendedModel: newModel,
                            recommendationScore: modelRecommendation.recommendation.score,
                            recommendationReason: modelRecommendation.recommendation.reason,
                            taskCategory: modelRecommendation.recommendation.category || null,
                            promptPreview: lastUserMessage?.content || '',
                          }),
                        })
                      }
                    } catch (error) {
                      console.error('Erro ao salvar histórico:', error)
                      // Silenciosamente falhar - não é crítico
                    }
                  }}
                  onDismiss={() => setModelRecommendation(null)}
                  onViewAlternatives={() => setShowRecommendationAlternatives(!showRecommendationAlternatives)}
                  showAlternatives={showRecommendationAlternatives}
                />
              </div>
            )}

            {/* Dicas contextuais para modelos específicos */}
            <ModelTipsCard provider={provider} model={model} />

            <ChatInput
              onSend={handleNewMessage}
              loading={loading}
              disabled={userRole === 'guest'}
              provider={provider}
              model={model}
              onTextChange={handleTextChange}
              onModelChange={(newProvider, newModel) => {
                setProvider(newProvider)
                setModel(newModel)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
