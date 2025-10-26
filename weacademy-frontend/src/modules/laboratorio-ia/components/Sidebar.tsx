'use client'

import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Conversation {
  id: string
  title: string
  updated_at: string
}

interface SidebarProps {
  conversations: Conversation[]
  currentConversationId?: string
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
}

export function Sidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full border-r bg-muted/20">
      {/* Header */}
      <div className="p-4 border-b">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4" />
          Nova Conversa
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-xs">Clique em "Nova Conversa" para começar</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                  currentConversationId === conversation.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'flex-1 justify-start gap-2 h-auto p-2',
                    currentConversationId === conversation.id &&
                      'text-primary-foreground hover:text-primary-foreground'
                  )}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate text-left text-sm">
                    {conversation.title}
                  </span>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
                    currentConversationId === conversation.id &&
                      'text-primary-foreground hover:text-primary-foreground'
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Deseja deletar esta conversa?')) {
                      onDeleteConversation(conversation.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t text-xs text-muted-foreground text-center">
        WE Academy - Laboratório da IA
      </div>
    </div>
  )
}
