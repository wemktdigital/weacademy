'use client'

import { Plus, MessageSquare, Trash2, Edit2, Star, MoreVertical, Compass, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface Conversation {
  id: string
  title: string
  updated_at: string
  is_favorite?: boolean
}

interface SidebarUserAgent {
  id: string
  name: string
  icon?: string | null
  isFavorite?: boolean
}

interface SidebarProps {
  conversations: Conversation[]
  currentConversationId?: string
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onRenameConversation?: (id: string, newTitle: string) => void
  onToggleFavorite?: (id: string, currentFavorite: boolean) => void
  onExploreAgents?: () => void
  userAgents?: SidebarUserAgent[]
  onSelectUserAgent?: (agentId: string) => void
  onRenameUserAgent?: (agentId: string, name: string) => void
  onDeleteUserAgent?: (agentId: string) => void
  onToggleFavoriteUserAgent?: (agentId: string, isFavorite: boolean) => void
}

export function Sidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleFavorite,
  onExploreAgents,
  userAgents = [],
  onSelectUserAgent,
  onRenameUserAgent,
  onDeleteUserAgent,
  onToggleFavoriteUserAgent,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleStartEdit = (conversation: Conversation) => {
    setEditingId(conversation.id)
    setEditValue(conversation.title)
  }

  const handleSaveEdit = (id: string) => {
    if (editValue.trim() && onRenameConversation) {
      onRenameConversation(id, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const handleStartEditAgent = (agent: SidebarUserAgent) => {
    const newName = prompt('Novo nome para o agente', agent.name)
    if (newName && newName.trim() && onRenameUserAgent) {
      onRenameUserAgent(agent.id, newName.trim())
    }
  }
  return (
    <div className="flex flex-col h-full border-r bg-muted/20 overflow-hidden" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4" />
          Nova Conversa
        </Button>
        {userAgents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Meus agentes
            </div>
            <div className="space-y-1">
              {userAgents.slice(0, 6).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition"
                >
                  <button
                    type="button"
                    onClick={() => onSelectUserAgent?.(agent.id)}
                    className="flex-1 flex items-center gap-2 text-left text-sm focus:outline-none min-w-0"
                  >
                    <span className="text-lg flex-shrink-0">{agent.icon || '🤖'}</span>
                    <span className="truncate block max-w-[150px]">{agent.name}</span>
                  </button>
                  {(onRenameUserAgent || onDeleteUserAgent || onToggleFavoriteUserAgent) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Ações do agente</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {onToggleFavoriteUserAgent && (
                          <DropdownMenuItem
                            onClick={() =>
                              onToggleFavoriteUserAgent(agent.id, !agent.isFavorite)
                            }
                          >
                            <Star
                              className={cn(
                                'h-4 w-4 mr-2',
                                agent.isFavorite && 'fill-yellow-400 text-yellow-400'
                              )}
                            />
                            {agent.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                          </DropdownMenuItem>
                        )}
                        {onRenameUserAgent && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleStartEditAgent(agent)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Renomear
                            </DropdownMenuItem>
                          </>
                        )}
                        {onDeleteUserAgent && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (confirm('Deseja remover este agente salvo?')) {
                                  onDeleteUserAgent(agent.id)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <Button
          onClick={onExploreAgents}
          className="w-full justify-start gap-2"
          variant="secondary"
        >
          <Compass className="h-4 w-4" />
          Explorar agentes
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-2 space-y-1 overflow-hidden" style={{ maxWidth: '100%' }}>
          {conversations.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-xs">Clique em "Nova Conversa" para começar</p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const isEditing = editingId === conversation.id
              const isActive = currentConversationId === conversation.id

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    'group relative flex items-center p-2 rounded-lg transition-colors overflow-hidden',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                  style={{ maxWidth: '100%', width: '100%' }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSaveEdit(conversation.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(conversation.id)
                        } else if (e.key === 'Escape') {
                          handleCancelEdit()
                        }
                      }}
                      className="w-full px-2 py-1 text-sm rounded border bg-background text-foreground"
                      autoFocus
                    />
                  ) : (
                    <>
                      {/* Container do título com truncamento agressivo */}
                      <div 
                        className="flex-1 min-w-0 overflow-hidden"
                        style={{ 
                          maxWidth: 'calc(100% - 50px)',
                          paddingRight: '8px'
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'w-full justify-start gap-2 h-auto p-2 overflow-hidden',
                            isActive &&
                              'text-primary-foreground hover:text-primary-foreground'
                          )}
                          onClick={() => onSelectConversation(conversation.id)}
                          title={conversation.title}
                        >
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />
                          <span 
                            className="truncate text-left text-sm block"
                            style={{ 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                              display: 'block'
                            }}
                          >
                            {conversation.title.length > 30
                              ? conversation.title.substring(0, 30) + '...'
                              : conversation.title}
                          </span>
                        </Button>
                      </div>
                      
                      {/* Menu de contexto - estilo ChatGPT */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex-shrink-0 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
                                isActive &&
                                  'text-primary-foreground hover:text-primary-foreground'
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Menu de ações</span>
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {onToggleFavorite && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleFavorite(conversation.id, conversation.is_favorite || false)
                              }}
                            >
                              <Star className={cn(
                                'h-4 w-4 mr-2',
                                conversation.is_favorite && 'fill-yellow-400 text-yellow-400'
                              )} />
                              {conversation.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                            </DropdownMenuItem>
                          )}
                          {onRenameConversation && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartEdit(conversation)
                                }}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Renomear
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Deseja deletar esta conversa?')) {
                                onDeleteConversation(conversation.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t text-xs text-muted-foreground text-center overflow-hidden">
        <div className="truncate" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          WE Academy - Laboratório da IA
        </div>
      </div>
    </div>
  )
}
