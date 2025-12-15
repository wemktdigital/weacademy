import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Agent } from '../agents'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  is_favorite?: boolean
}

interface Conversation {
  id: string
  title: string
  updated_at: string
  provider?: string
  model?: string
}

interface ChatState {
  // Estado atual
  conversationId: string | null
  messages: Message[]
  isStreaming: boolean
  provider: string
  model: string
  selectedAgent: Agent | null
  
  // Conversas
  conversations: Conversation[]
  
  // Ações
  setConversationId: (id: string | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateLastMessage: (content: string) => void
  setIsStreaming: (streaming: boolean) => void
  setProvider: (provider: string) => void
  setModel: (model: string) => void
  setSelectedAgent: (agent: Agent | null) => void
  setConversations: (conversations: Conversation[]) => void
  resetChat: () => void
}

const initialModel = typeof window !== 'undefined' 
  ? localStorage.getItem('lab-preferred-model')?.split(':')[1] || 'gpt-5-nano'
  : 'gpt-5-nano'

const initialProvider = typeof window !== 'undefined'
  ? localStorage.getItem('lab-preferred-model')?.split(':')[0] || 'OpenAI'
  : 'OpenAI'

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversationId: null,
      messages: [],
      isStreaming: false,
      provider: initialProvider,
      model: initialModel,
      selectedAgent: null,
      conversations: [],

      setConversationId: (id) => set({ conversationId: id }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      updateLastMessage: (content) => set((state) => {
        const messages = [...state.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage) {
          messages[messages.length - 1] = { ...lastMessage, content }
        }
        return { messages }
      }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),
      setSelectedAgent: (agent) => set({ selectedAgent: agent }),
      setConversations: (conversations) => set({ conversations }),
      resetChat: () => set({
        conversationId: null,
        messages: [],
        isStreaming: false,
      }),
    }),
    {
      name: 'lab-chat-store',
      partialize: (state) => ({
        provider: state.provider,
        model: state.model,
      }),
    }
  )
)
