'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/modules/laboratorio-ia/components/Sidebar'
import { ChatInput } from '@/modules/laboratorio-ia/components/ChatInput'
import { MessageBubble } from '@/modules/laboratorio-ia/components/MessageBubble'
import { ModelSelector } from '@/modules/laboratorio-ia/components/ModelSelector'
import { AgentSelector } from '@/modules/laboratorio-ia/components/AgentSelector'
import { useChatStore } from '@/modules/laboratorio-ia/hooks/useChatStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

export default function AILabPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Carregar conversas ao montar
  useEffect(() => {
    if (user) {
      loadConversations()
      loadUserRole()
    }
  }, [user])

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

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('lab_conversations')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setConversations(data || [])
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
      setMessages(data || [])
      setCurrentConversationId(conversationId)
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    }
  }

  const createNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
  }

  const handleNewMessage = async (content: string) => {
    if (!user) return

    setLoading(true)

    // Criar ou obter conversation_id
    let conversationId = currentConversationId

    if (!conversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('lab_conversations')
        .insert({
          user_id: user.id,
          title: content.substring(0, 50),
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
      content,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Salvar mensagem do usuário no banco
    await supabase.from('lab_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content,
    })

    // Chamar API para resposta do assistente
    try {
      const response = await fetch('/api/lab-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messages: [...messages, userMessage],
          provider,
          model,
          agentId: selectedAgent?.id,
        }),
      })

      if (!response.ok) throw new Error('Erro ao obter resposta')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      let assistantContent = ''

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        assistantContent += chunk

        // Atualizar mensagem em tempo real
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage?.role === 'assistant' && !lastMessage.id.includes('temp')) {
            return [...prev.slice(0, -1), { ...lastMessage, content: assistantContent }]
          }
          return [
            ...prev,
            {
              id: 'temp-assistant',
              role: 'assistant' as const,
              content: assistantContent,
              created_at: new Date().toISOString(),
            },
          ]
        })
      }

      // Salvar mensagem completa do assistente
      const { error: msgError } = await supabase.from('lab_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
      })

      if (msgError) console.error('Erro ao salvar mensagem:', msgError)

      // Atualizar conversas
      await loadConversations()
    } catch (error) {
      console.error('Erro no chat:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
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
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId || undefined}
          onNewChat={createNewConversation}
          onSelectConversation={loadConversation}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header com seletor de modelo e agente */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Laboratório da IA</h1>
              {selectedAgent && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <span>{selectedAgent.icon}</span>
                  <span>{selectedAgent.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AgentSelector
                selectedAgentId={selectedAgent?.id}
                onSelect={setSelectedAgent}
              />
              <ModelSelector
                value={`${provider}:${model}`}
                onChange={(newProvider, newModel) => {
                  setProvider(newProvider)
                  setModel(newModel)
                }}
              />
              {isAdmin && (
                <Link href="/ai-lab/admin/agents">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-2xl p-8">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h2 className="text-2xl font-bold mb-2">
                  Bem-vindo ao Laboratório da IA
                </h2>
                <p className="text-muted-foreground mb-8">
                  Faça perguntas, crie conteúdo ou explore o poder da inteligência artificial.
                  Selecione um modelo acima e comece a conversar!
                </p>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">💡 Dicas de uso</h3>
                      <p className="text-sm text-muted-foreground">
                        Seja específico e claro em suas perguntas para obter melhores resultados.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">📝 Geração de conteúdo</h3>
                      <p className="text-sm text-muted-foreground">
                        Crie roteiros, artigos, posts e muito mais com a ajuda da IA.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.created_at}
                />
              ))}
              {loading && (
                <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">
                    {selectedAgent ? `Executando agente ${selectedAgent.icon}...` : 'Pensando...'}
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
          <ChatInput onSend={handleNewMessage} loading={loading} disabled={userRole === 'guest'} />
        )}
      </div>
    </div>
  )
}
