'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/modules/laboratorio-ia/components/Sidebar'
import { ChatInput, Attachment } from '@/modules/laboratorio-ia/components/ChatInput'
import { MessageBubble } from '@/modules/laboratorio-ia/components/MessageBubble'
import { ChatModelSelector } from '@/modules/laboratorio-ia/components/ChatModelSelector'
import { AgentSelector } from '@/modules/laboratorio-ia/components/AgentSelector'
import { PipelineSelector } from '@/modules/laboratorio-ia/components/PipelineSelector'
import { PipelineProgress } from '@/modules/laboratorio-ia/components/PipelineProgress'
import { CostEstimateCard } from '@/modules/laboratorio-ia/components/CostEstimateCard'
import { ModelRecommendationCard } from '@/modules/laboratorio-ia/components/ModelRecommendationCard'
import { RoutingPreferencesDialog } from '@/modules/laboratorio-ia/components/RoutingPreferencesDialog'
import { useChatStore } from '@/modules/laboratorio-ia/hooks/useChatStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, Settings, History, Image, Video, Wand2, Stethoscope, Compass, ArrowRight, X, ClipboardList, Upload, Repeat, Menu } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useRouter } from 'next/navigation'
import { getAgentById } from '@/modules/laboratorio-ia/agents'

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
  const [userRole, setUserRole] = useState<string | null>(null)
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
        provider: staticAgent.provider,
        model: staticAgent.model,
        type: staticAgent.type,
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
      .filter((agent): agent is AgentSummary & { lastUsed: number } => Boolean(agent))
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
      provider: selectedAgent.provider || base?.provider || null,
      model: selectedAgent.model || base?.model || null,
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
      provider: agent.provider,
      model: agent.model,
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
      provider: agent.provider,
      model: agent.model,
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
          
          // Parse attachments se existirem
          const messagesWithAttachments = (data || []).map((msg: any) => ({
            ...msg,
            attachments: msg.attachments ? JSON.parse(msg.attachments) : undefined,
          }))
          
          setMessages(messagesWithAttachments)
          setCurrentConversationId(conversationId)
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

  const handleNewMessage = async (content: string, attachments?: Attachment[]) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para usar o Laboratório de IA',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setIsCanceling(false)

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
      await supabase.from('lab_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage.content,
        ...(attachments && attachments.length > 0 && { attachments: JSON.stringify(attachments) }),
      })
    } catch (error: any) {
      // Se o campo attachments não existir, tentar sem ele
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

      const requestBody = selectedPipeline
        ? {
            pipelineId: selectedPipeline.id,
            messages: [...messages, userMessage],
          }
        : {
            conversationId,
            messages: [...messages, userMessage],
            provider,
            model,
            agentId: selectedAgent?.id,
            enableIntelligentRouting: intelligentRoutingEnabled && !selectedAgent, // Não usar routing se agente específico selecionado
            enableFallback: intelligentRoutingEnabled,
            enableCache: true,
            preferences: routingPreferences, // Passar preferências para o routing
          }

      let assistantContent = ''
      const tempAssistantId = `temp-assistant-${Date.now()}`
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

        while (true) {
          const { done, value } = await reader!.read()
          if (done) break

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
                  }
                  metadataProcessed = true
                  buffer = parts[1] || '' // Continuar com o resto do buffer
                  continue
                }
              } catch (e) {
                // Não é metadados, continuar normalmente
              }
            }
            metadataProcessed = true // Marcar como processado mesmo se não encontrou metadados
          }
          
          // Processar linhas SSE ou texto puro
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Manter última linha incompleta

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              // Tentar parsear como JSON (metadados) ou usar como texto
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'metadata') continue // Já processado
              } catch (e) {
                // Não é JSON, usar como conteúdo
                assistantContent += line.slice(6) // Remover 'data: '
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Conteúdo normal
              assistantContent += line
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

      // Salvar mensagem completa do assistente
      const { error: msgError } = await supabase.from('lab_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
      })

      if (msgError) console.error('Erro ao salvar mensagem:', msgError)

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
              <ChatModelSelector
                provider={provider}
                model={model}
                onChange={(newProvider, newModel) => {
                  setProvider(newProvider)
                  setModel(newModel)
                }}
              />
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Sparkles className="h-6 w-6 text-primary flex-shrink-0" />
              <h1 className="text-2xl font-bold">Laboratório da IA</h1>
              {/* Seletor de modelo no estilo ChatGPT */}
              <ChatModelSelector
                provider={provider}
                model={model}
                onChange={(newProvider, newModel) => {
                  setProvider(newProvider)
                  setModel(newModel)
                }}
              />
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
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
              <AgentSelector
                selectedAgentId={selectedAgent?.id}
                onSelect={(agent) => {
                  setSelectedAgent(agent)
                  // Se agente selecionado, remover pipeline (mutuamente exclusivo)
                  if (agent) {
                    setSelectedPipeline(null)
                    // Pré-selecionar provider/model do agente se definidos
                    if (agent.provider) {
                      setProvider(agent.provider)
                    }
                    if (agent.model) {
                      setModel(agent.model)
                    }
                    registerAgentUsage({
                      id: agent.id!,
                      name: agent.name,
                      description: agent.description,
                      icon: agent.icon,
                      category: agent.category,
                      provider: agent.provider,
                      model: agent.model,
                      type: agent.type,
                    })
                  }
                }}
              />
              <RoutingPreferencesDialog
                preferences={routingPreferences}
                onPreferencesChange={(prefs) => {
                  setRoutingPreferences(prefs)
                  setIntelligentRoutingEnabled(prefs.intelligentRoutingEnabled)
                }}
              />
              <Link href="/ai-lab/pipelines/history">
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
              </Link>
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
              {messages.map((message) => (
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
                />
              ))}
              {loading && !pipelineProgress && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">
                    {selectedPipeline 
                      ? `Executando pipeline ${selectedPipeline.name}...` 
                      : selectedAgent 
                        ? `Executando agente ${selectedAgent.icon}...` 
                        : 'Pensando...'}
                  </span>
                </div>
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
            <ChatInput 
              onSend={handleNewMessage} 
              loading={loading} 
              disabled={userRole === 'guest'}
              provider={provider}
              model={model}
              onTextChange={handleTextChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
